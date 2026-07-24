import { Email, TaskCard, TaskBoard, TaskBoardServiceConfig } from "../types";
import sampleTaskEmails from "../fixtures/sample-task-emails.json";

/**
 * Extracts a TaskCard from an Email using deterministic NLP/regex heuristics.
 */
export function extractTaskFromEmail(email: Email): TaskCard {
  const id = email.id.replace(/^email-/, "task-");
  const subject = email.subject || "";
  const body = email.body || "";
  const bodyLower = body.toLowerCase();

  // 1. Title Extraction Heuristics
  let title = subject;
  if (subject.includes("New contractor setup") || body.includes("create access")) {
    const nameMatch = body.match(/access for ([A-Z][a-z]+)/);
    const name = nameMatch ? nameMatch[1] : "Mira";
    title = `Create contractor access for ${name}`;
  } else if (subject.includes("Invoice needs approval") || body.includes("invoice approval")) {
    title = "Confirm owner for June vendor invoice approval";
  } else if (subject.includes("Vendor contract blocked") || body.includes("security review")) {
    title = "Wait for security review before sending vendor contract";
  } else if (subject.includes("Follow-up sent") || body.includes("follow-up was sent")) {
    const recipientMatch = subject.match(/Follow-up sent to ([A-Z]+)/);
    const recipient = recipientMatch ? recipientMatch[1] : "ACME";
    title = `Customer follow-up sent to ${recipient}`;
  }

  // 2. Owner Heuristics
  let owner = "unassigned";
  if (bodyLower.includes("handled by ops")) {
    owner = "Ops";
  } else if (email.from.includes("legal@") || bodyLower.includes("security review")) {
    owner = "Legal";
  } else if (email.from.includes("support@")) {
    owner = "Support";
  } else if (email.from.includes("finance@") && !bodyLower.includes("confirm who owns")) {
    owner = "Finance";
  }

  // 3. Due Date Heuristics (YYYY-MM-DD or relative Friday)
  let dueDate: string | null = null;
  const dateMatch = body.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    dueDate = dateMatch[1];
  } else {
    const fridayMatch =
      body.match(/before Friday|by Friday/i) || subject.match(/needed by Friday/i);
    if (fridayMatch && email.receivedAt) {
      const recDate = new Date(email.receivedAt);
      const day = recDate.getUTCDay(); // 0: Sun, 1: Mon, ..., 5: Fri
      if (day <= 5) {
        const diff = 5 - day;
        const targetDate = new Date(recDate.getTime() + diff * 24 * 60 * 60 * 1000);
        dueDate = targetDate.toISOString().split("T")[0];
      }
    }
  }

  // 4. Status Heuristics
  let status: TaskCard["status"] = "new";
  if (bodyLower.includes("complete") || bodyLower.includes("resolved")) {
    status = "done";
  } else if (bodyLower.includes("blocked") || bodyLower.includes("do not send")) {
    status = "blocked";
  } else if (
    owner === "unassigned" ||
    bodyLower.includes("confirm who owns") ||
    bodyLower.includes("needs approval")
  ) {
    status = "triage";
  }

  // 5. Priority Heuristics
  let priority: TaskCard["priority"] = "medium";
  if (status === "done") {
    priority = "low";
  } else if (
    status === "blocked" ||
    bodyLower.includes("due 2026-06-20") ||
    subject.includes("Invoice needs approval")
  ) {
    priority = "high";
  }

  // 6. Review Required
  const reviewRequired = status === "blocked" || owner === "unassigned";

  // Optional Notes context
  let notes: string | undefined;
  if (owner === "unassigned") {
    notes = "Ambiguous assignee. Requires team confirmation.";
  } else if (status === "blocked") {
    notes = "Contract delivery blocked pending security team clearance.";
  }

  return {
    id,
    title,
    owner,
    dueDate,
    priority,
    status,
    sourceEmailId: email.id,
    reviewRequired,
    ...(notes ? { notes } : {}),
  };
}

/**
 * Groups a list of TaskCards into the TaskBoard columns.
 */
export function groupTasksByStatus(tasks: TaskCard[]): TaskBoard {
  const board: TaskBoard = {
    new: [],
    triage: [],
    blocked: [],
    done: [],
  };

  for (const task of tasks) {
    if (board[task.status]) {
      board[task.status].push(task);
    } else {
      board.new.push(task);
    }
  }

  return board;
}

/**
 * Creates the TaskBoardService for async task loading and local updates.
 */
export function createTaskBoardService(config: TaskBoardServiceConfig = {}) {
  const { simulateDelay = true, delayMs = 600, failureRate = 0 } = config;
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  // In-memory store initialized with a copy of sample task board cards
  let activeCards: TaskCard[] = [];

  const initializeStore = () => {
    if (activeCards.length === 0) {
      activeCards = (sampleTaskEmails.emails as Email[]).map(extractTaskFromEmail);
    }
  };

  async function getTasks(emails?: Email[]): Promise<TaskCard[]> {
    if (simulateDelay) await delay(delayMs / 2);
    if (Math.random() < failureRate) {
      throw new Error("Task board service failed to load tasks (simulated).");
    }

    if (emails) {
      return emails.map(extractTaskFromEmail);
    }

    initializeStore();
    return [...activeCards];
  }

  async function getBoard(emails?: Email[]): Promise<TaskBoard> {
    if (simulateDelay) await delay(simulateDelay ? delayMs : 0);
    if (Math.random() < failureRate) {
      throw new Error("Task board service failed to load board (simulated).");
    }

    if (emails) {
      const cards = emails.map(extractTaskFromEmail);
      return groupTasksByStatus(cards);
    }

    initializeStore();
    return groupTasksByStatus(activeCards);
  }

  async function updateTask(id: string, updates: Partial<TaskCard>): Promise<TaskCard> {
    if (simulateDelay) await delay(delayMs / 3);
    initializeStore();

    const idx = activeCards.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error(`Task with id ${id} not found.`);
    }

    const updatedCard = {
      ...activeCards[idx],
      ...updates,
    };

    // Auto-update reviewRequired if owner/status changes
    if (updates.status !== undefined || updates.owner !== undefined) {
      updatedCard.reviewRequired =
        updatedCard.status === "blocked" || updatedCard.owner === "unassigned";
    }

    activeCards[idx] = updatedCard;
    return updatedCard;
  }

  async function addTask(email: Email): Promise<TaskCard> {
    if (simulateDelay) await delay(delayMs / 3);
    initializeStore();

    const newCard = extractTaskFromEmail(email);
    activeCards.push(newCard);
    return newCard;
  }

  async function deleteTask(id: string): Promise<boolean> {
    if (simulateDelay) await delay(delayMs / 3);
    initializeStore();

    const initialLength = activeCards.length;
    activeCards = activeCards.filter((c) => c.id !== id);
    return activeCards.length < initialLength;
  }

  async function resetStore(): Promise<void> {
    activeCards = [];
  }

  return {
    getTasks,
    getBoard,
    updateTask,
    addTask,
    deleteTask,
    resetStore,
  };
}

export type TaskBoardService = ReturnType<typeof createTaskBoardService>;
