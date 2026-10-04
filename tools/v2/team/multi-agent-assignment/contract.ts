/**
 * contract.ts — Multi-Agent Assignment (non-UI execution contract)
 *
 * Backend-facing execution contract for multi-agent assignment operations. It is
 * presentation-free: no React, no DOM. Operations return a typed
 * `AssignmentResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 *
 * The underlying stateful logic already exists in `./services/assignment.service.ts`
 * (`createAssignmentService`, which throws errors for not-found conditions); this
 * contract wraps it so callers receive typed results rather than catching exceptions.
 */

import type { Agent, Thread, AssignmentLog, AssignmentMetrics } from "./types";
import { createAssignmentService } from "./services/assignment.service";

/** Explicit, machine-readable error codes for contract operations. */
export enum AssignmentErrorCode {
  /** Input failed validation (missing/empty fields). */
  InvalidInput = "INVALID_INPUT",
  /** The referenced thread was not found. */
  ThreadNotFound = "THREAD_NOT_FOUND",
  /** The referenced agent was not found. */
  AgentNotFound = "AGENT_NOT_FOUND",
  /** Operation cannot be performed in current state (e.g., assigning to resolved thread). */
  InvalidOperation = "INVALID_OPERATION",
  /** No active agents available for auto-assignment. */
  NoActiveAgents = "NO_ACTIVE_AGENTS",
}

/** Discriminated outcome returned by every contract operation. */
export type AssignmentResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AssignmentErrorCode; message: string };

/** Operations supported by the assignment contract. */
export type AssignmentOperation =
  | { operation: "getAgents" }
  | { operation: "getThreads" }
  | { operation: "getLogs" }
  | { operation: "assignAgent"; threadId: string; agentId: string; operator?: string }
  | { operation: "unassignAgent"; threadId: string; agentId: string; operator?: string }
  | { operation: "updateAgentStatus"; agentId: string; status: "active" | "busy" | "offline" }
  | { operation: "resolveThread"; threadId: string; operator?: string }
  | { operation: "autoAssign"; threadId: string }
  | { 
      operation: "simulateIncomingThread";
      subject: string;
      snippet: string;
      sender: string;
      priority: "low" | "medium" | "high";
      category?: string;
    }
  | { operation: "getMetrics" };

/** Output produced by the contract, keyed by operation. */
export type AssignmentContractOutput =
  | { operation: "getAgents"; agents: Agent[] }
  | { operation: "getThreads"; threads: Thread[] }
  | { operation: "getLogs"; logs: AssignmentLog[] }
  | { operation: "assignAgent"; thread: Thread }
  | { operation: "unassignAgent"; thread: Thread }
  | { operation: "updateAgentStatus"; agent: Agent }
  | { operation: "resolveThread"; thread: Thread }
  | { operation: "autoAssign"; thread: Thread }
  | { operation: "simulateIncomingThread"; thread: Thread }
  | { operation: "getMetrics"; metrics: AssignmentMetrics };

/** Backend-facing entry point for multi-agent assignment. */
export interface AssignmentContract {
  execute(input: AssignmentOperation): AssignmentResult<AssignmentContractOutput>;
}

/** Typed success outcome. */
export function ok<T>(value: T): AssignmentResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: AssignmentErrorCode, message: string): AssignmentResult<T> {
  return { ok: false, error, message };
}

/** Map a thrown service error to a typed contract result. */
function toResult<T>(err: unknown): AssignmentResult<T> {
  const message = err instanceof Error ? err.message : String(err);
  
  if (message.includes("not found")) {
    if (message.includes("Thread")) {
      return fail(AssignmentErrorCode.ThreadNotFound, message);
    }
    if (message.includes("Agent")) {
      return fail(AssignmentErrorCode.AgentNotFound, message);
    }
  }
  
  if (message.includes("already resolved") || message.includes("resolved. Cannot")) {
    return fail(AssignmentErrorCode.InvalidOperation, message);
  }
  
  if (message.includes("No active agents")) {
    return fail(AssignmentErrorCode.NoActiveAgents, message);
  }
  
  return fail(AssignmentErrorCode.InvalidInput, message);
}

/**
 * Build the assignment execution contract from an assignment service instance.
 *
 * The contract adapts the service's throwing methods into typed results, so
 * callers never catch exceptions. The service owns all state.
 */
export function createAssignmentContract(
  initialAgents?: Agent[],
  initialThreads?: Thread[],
): AssignmentContract {
  const service = createAssignmentService(initialAgents, initialThreads);
  
  return {
    execute(input: AssignmentOperation): AssignmentResult<AssignmentContractOutput> {
      try {
        switch (input.operation) {
          case "getAgents": {
            const agents = service.getAgents();
            return ok({ operation: "getAgents", agents });
          }
          case "getThreads": {
            const threads = service.getThreads();
            return ok({ operation: "getThreads", threads });
          }
          case "getLogs": {
            const logs = service.getLogs();
            return ok({ operation: "getLogs", logs });
          }
          case "assignAgent": {
            const thread = service.assignAgent(input.threadId, input.agentId, input.operator);
            return ok({ operation: "assignAgent", thread });
          }
          case "unassignAgent": {
            const thread = service.unassignAgent(input.threadId, input.agentId, input.operator);
            return ok({ operation: "unassignAgent", thread });
          }
          case "updateAgentStatus": {
            const agent = service.updateAgentStatus(input.agentId, input.status);
            return ok({ operation: "updateAgentStatus", agent });
          }
          case "resolveThread": {
            const thread = service.resolveThread(input.threadId, input.operator);
            return ok({ operation: "resolveThread", thread });
          }
          case "autoAssign": {
            const thread = service.autoAssign(input.threadId);
            return ok({ operation: "autoAssign", thread });
          }
          case "simulateIncomingThread": {
            const thread = service.simulateIncomingThread(
              input.subject,
              input.snippet,
              input.sender,
              input.priority,
              input.category,
            );
            return ok({ operation: "simulateIncomingThread", thread });
          }
          case "getMetrics": {
            const metrics = service.getMetrics();
            return ok({ operation: "getMetrics", metrics });
          }
          default: {
            const _never: never = input;
            return fail(AssignmentErrorCode.InvalidInput, `Unknown operation: ${JSON.stringify(_never)}`);
          }
        }
      } catch (err) {
        return toResult(err);
      }
    },
  };
}
