/**
 * In-memory reference backend for the Legal & Compliance Review Flag tool.
 *
 * `createReviewFlagService` needs a `ReviewFlagBackend` to talk to (auth,
 * datastore, id/time providers). This module supplies a deterministic,
 * dependency-free implementation so the tool can be exercised end to end in
 * tests, demos, or a CLI without a database, network, or real clock.
 *
 * It imports only types from the contract and service, so it carries no
 * runtime I/O of its own.
 */

import type { ReviewFlagInput } from "../contract";
import type { ReviewFlagBackend } from "./review-flag-service";

export interface InMemoryReviewFlagBackendOptions {
  /** Reviewer ids allowed to raise flags. Defaults to none. */
  authorizedReviewers?: Iterable<string>;
  /** Resource ids treated as existing. Defaults to none. */
  knownResources?: Iterable<string>;
  /** Injectable clock in epoch milliseconds. Defaults to a fixed timestamp. */
  now?: () => number;
  /** Injectable id factory. Defaults to a deterministic counter. */
  newId?: () => string;
}

export interface StoredReviewFlag {
  flagId: string;
  input: ReviewFlagInput;
  createdAt: number;
}

/** Fixed timestamp used when no clock is injected, keeping tests reproducible. */
export const DEFAULT_REVIEW_FLAG_TIMESTAMP = 1_700_000_000_000;

/** Deterministic, dependency-free implementation of `ReviewFlagBackend`. */
export class InMemoryReviewFlagBackend implements ReviewFlagBackend {
  private readonly authorizedReviewers: Set<string>;
  private readonly knownResources: Set<string>;
  private readonly clock: () => number;
  private readonly customIdFactory?: () => string;
  private readonly openFlags = new Map<string, StoredReviewFlag>();
  private counter = 0;

  constructor(options: InMemoryReviewFlagBackendOptions = {}) {
    this.authorizedReviewers = new Set(options.authorizedReviewers ?? []);
    this.knownResources = new Set(options.knownResources ?? []);
    this.clock = options.now ?? (() => DEFAULT_REVIEW_FLAG_TIMESTAMP);
    this.customIdFactory = options.newId;
  }

  async isAuthorizedReviewer(reviewer: string): Promise<boolean> {
    return this.authorizedReviewers.has(reviewer);
  }

  async resourceExists(targetResource: string): Promise<boolean> {
    return this.knownResources.has(targetResource);
  }

  async findOpenFlag(targetResource: string): Promise<string | null> {
    const stored = this.openFlags.get(targetResource);
    return stored ? stored.flagId : null;
  }

  async saveFlag(input: ReviewFlagInput, flagId: string): Promise<void> {
    this.openFlags.set(input.targetResource, {
      flagId,
      input,
      createdAt: this.clock(),
    });
  }

  now(): number {
    return this.clock();
  }

  newId(): string {
    if (this.customIdFactory) {
      return this.customIdFactory();
    }
    this.counter += 1;
    return `flag:mem-${this.counter}`;
  }

  /** All flags currently held open, in insertion order. */
  listOpenFlags(): readonly StoredReviewFlag[] {
    return [...this.openFlags.values()];
  }

  /** Clears stored flags and resets the default id counter. */
  reset(): void {
    this.openFlags.clear();
    this.counter = 0;
  }
}

/** Convenience factory mirroring the other `create*` helpers in this folder. */
export function createInMemoryReviewFlagBackend(
  options: InMemoryReviewFlagBackendOptions = {},
): InMemoryReviewFlagBackend {
  return new InMemoryReviewFlagBackend(options);
}
