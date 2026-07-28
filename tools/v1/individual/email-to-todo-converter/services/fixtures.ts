import type { NormalizedEmail, TaskDraft, TaskPriority } from "./emailToTodo";

export interface FixtureEntry {
  email: NormalizedEmail;
  expected: {
    title: string;
    priority: TaskPriority;
    dueDate: string;
    hasNotes: boolean;
  };
}

export const emailFixtures: Record<string, FixtureEntry> = {
  directRequest: {
    email: {
      subject: "Please review the invoice by Friday",
      sender: "billing@example.com",
      receivedAt: "2026-06-19T09:00:00.000Z",
      body: "Please review the attached invoice by Friday and let me know if anything is missing.",
      labels: ["inbox"],
    },
    expected: {
      title: "Please review the invoice by Friday",
      priority: "low",
      dueDate: "2026-06-22",
      hasNotes: true,
    },
  },
  urgentFollowUp: {
    email: {
      subject: "Urgent: follow up with partner",
      sender: "ops@example.com",
      receivedAt: "2026-06-19T10:30:00.000Z",
      body: "Can you follow up with the partner today? This is blocking the launch checklist.",
      labels: ["important"],
    },
    expected: {
      title: "Urgent: follow up with partner",
      priority: "high",
      dueDate: "2026-06-20",
      hasNotes: true,
    },
  },
  newsletter: {
    email: {
      subject: "Weekly product updates",
      sender: "newsletter@example.com",
      receivedAt: "2026-06-19T11:00:00.000Z",
      body: "Here are this week's product updates and release notes.",
      labels: ["newsletter"],
    },
    expected: {
      title: "Weekly product updates",
      priority: "low",
      dueDate: "2026-06-22",
      hasNotes: true,
    },
  },
  emptySubject: {
    email: {
      subject: "",
      sender: "alex@example.com",
      receivedAt: "2026-06-20T08:00:00.000Z",
      body: "Call the bank about the invoice.",
    },
    expected: {
      title: "Call the bank about the invoice.",
      priority: "low",
      dueDate: "2026-06-23",
      hasNotes: true,
    },
  },
  blankBodyAndSubject: {
    email: {
      subject: "",
      sender: "test@example.com",
      receivedAt: "2026-06-20T08:00:00.000Z",
      body: "",
    },
    expected: {
      title: "Untitled task",
      priority: "low",
      dueDate: "2026-06-23",
      hasNotes: false,
    },
  },
  mediumPriority: {
    email: {
      subject: "Reminder: team meeting today",
      sender: "manager@example.com",
      receivedAt: "2026-06-21T07:00:00.000Z",
      body: "Just a reminder about our team meeting today at 3pm.",
    },
    expected: {
      title: "Reminder: team meeting today",
      priority: "medium",
      dueDate: "2026-06-24",
      hasNotes: true,
    },
  },
  withLabels: {
    email: {
      subject: "Q3 budget review",
      sender: "finance@example.com",
      receivedAt: "2026-06-22T12:00:00.000Z",
      body: "Please prepare the Q3 budget for review.",
      labels: ["work", "finance", "important"],
    },
    expected: {
      title: "Q3 budget review",
      priority: "low",
      dueDate: "2026-06-25",
      hasNotes: true,
    },
  },
};

export const fixtureEmailList: NormalizedEmail[] = Object.values(emailFixtures).map(
  (entry) => entry.email,
);

export function buildExpectedDraft(entry: FixtureEntry): Partial<TaskDraft> {
  return {
    title: entry.expected.title,
    suggestedPriority: entry.expected.priority,
    suggestedDueDate: entry.expected.dueDate,
  };
}
