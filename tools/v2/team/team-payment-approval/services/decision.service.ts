/**
 * Local Decision Service
 *
 * Handles recording and managing approval decisions locally.
 * Decisions are stored in memory and can be persisted to localStorage if needed.
 */

import type { ApprovalDecision } from "../types";

class DecisionService {
  private decisions: Map<string, ApprovalDecision> = new Map();
  private storageKey = "team-payment-approval-decisions";

  constructor(private useStorage: boolean = false) {
    if (useStorage) {
      this.loadFromStorage();
    }
  }

  /**
   * Record a decision
   */
  recordDecision(decision: ApprovalDecision): void {
    this.decisions.set(decision.paymentId, decision);
    if (this.useStorage) {
      this.saveToStorage();
    }
  }

  /**
   * Get a decision for a payment
   */
  getDecision(paymentId: string): ApprovalDecision | undefined {
    return this.decisions.get(paymentId);
  }

  /**
   * Get all decisions
   */
  getAllDecisions(): ApprovalDecision[] {
    return Array.from(this.decisions.values());
  }

  /**
   * Get approval count
   */
  getApprovalCount(): number {
    return Array.from(this.decisions.values()).filter((d) => d.decision === "approve").length;
  }

  /**
   * Get rejection count
   */
  getRejectionCount(): number {
    return Array.from(this.decisions.values()).filter((d) => d.decision === "reject").length;
  }

  /**
   * Clear all decisions
   */
  clear(): void {
    this.decisions.clear();
    if (this.useStorage) {
      localStorage.removeItem(this.storageKey);
    }
  }

  /**
   * Save decisions to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.decisions.values());
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (err) {
      console.error("Failed to save decisions to storage:", err);
    }
  }

  /**
   * Load decisions from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const decisions: ApprovalDecision[] = JSON.parse(data);
        decisions.forEach((d) => {
          this.decisions.set(d.paymentId, d);
        });
      }
    } catch (err) {
      console.error("Failed to load decisions from storage:", err);
    }
  }
}

// Singleton instances
export const decisionService = new DecisionService(false); // In-memory only by default
export const persistentDecisionService = new DecisionService(true); // With localStorage
