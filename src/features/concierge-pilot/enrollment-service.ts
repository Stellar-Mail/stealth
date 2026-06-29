/**
 * Pilot Enrollment Service
 * 
 * Manages pilot user enrollment, consent tracking, and phase transitions.
 */

import type { PilotUser, PilotPhase } from "./types";

export class PilotEnrollmentService {
  private users: Map<string, PilotUser> = new Map();
  private maxCohortSize: number = 12;
  private enrollmentOpen: boolean = false;

  constructor(maxCohortSize: number = 12) {
    this.maxCohortSize = maxCohortSize;
  }

  /**
   * Open enrollment for the pilot.
   */
  openEnrollment(): void {
    this.enrollmentOpen = true;
  }

  /**
   * Close enrollment for the pilot.
   */
  closeEnrollment(): void {
    this.enrollmentOpen = false;
  }

  /**
   * Check if enrollment is currently open.
   */
  isEnrollmentOpen(): boolean {
    return this.enrollmentOpen;
  }

  /**
   * Enroll a new user in the pilot.
   * Returns null if enrollment is full or closed.
   */
  enrollUser(userId: string): PilotUser | null {
    if (!this.enrollmentOpen) {
      return null;
    }

    if (this.users.size >= this.maxCohortSize) {
      return null;
    }

    if (this.users.has(userId)) {
      return this.users.get(userId)!;
    }

    const user: PilotUser = {
      id: userId,
      enrolledAt: Date.now(),
      consentGiven: false,
      phase: "enrollment",
    };

    this.users.set(userId, user);
    return user;
  }

  /**
   * Get an enrolled user.
   */
  getUser(userId: string): PilotUser | undefined {
    return this.users.get(userId);
  }

  /**
   * Confirm consent for a pilot user.
   */
  confirmConsent(userId: string): PilotUser | undefined {
    const user = this.users.get(userId);
    if (user) {
      user.consentGiven = true;
      user.consentGivenAt = Date.now();
      // Transition to active phase once consent is given
      if (user.phase === "enrollment") {
        user.phase = "active";
      }
    }
    return user;
  }

  /**
   * Check if user has given consent.
   */
  hasGivenConsent(userId: string): boolean {
    return this.users.get(userId)?.consentGiven ?? false;
  }

  /**
   * Transition a user to a new phase.
   */
  transitionPhase(userId: string, newPhase: PilotPhase): PilotUser | undefined {
    const user = this.users.get(userId);
    if (user) {
      user.phase = newPhase;
    }
    return user;
  }

  /**
   * Get current phase for a user.
   */
  getUserPhase(userId: string): PilotPhase | undefined {
    return this.users.get(userId)?.phase;
  }

  /**
   * Get all enrolled users.
   */
  getAllUsers(): PilotUser[] {
    return Array.from(this.users.values());
  }

  /**
   * Get users in a specific phase.
   */
  getUsersByPhase(phase: PilotPhase): PilotUser[] {
    return Array.from(this.users.values()).filter((u) => u.phase === phase);
  }

  /**
   * Get cohort size.
   */
  getCohortSize(): number {
    return this.users.size;
  }

  /**
   * Get enrollment progress (current / max).
   */
  getEnrollmentProgress(): { current: number; max: number } {
    return {
      current: this.users.size,
      max: this.maxCohortSize,
    };
  }

  /**
   * Calculate consent rate.
   */
  getConsentRate(): number {
    if (this.users.size === 0) return 0;
    const consented = Array.from(this.users.values()).filter(
      (u) => u.consentGiven,
    ).length;
    return (consented / this.users.size) * 100;
  }

  /**
   * Remove a user from the pilot.
   */
  removeUser(userId: string): boolean {
    return this.users.delete(userId);
  }

  /**
   * Clear all data (useful for testing).
   */
  clearData(): void {
    this.users.clear();
  }
}

export const enrollmentService = new PilotEnrollmentService();
