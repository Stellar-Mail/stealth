/**
 * Scenario registry for the demo admin dashboard.
 *
 * A small, dependency-free registry used to register, load, and merge demo
 * "scenarios" while detecting duplicate-id conflicts.
 *
 * All data is fake, deterministic, and safe for public repository review.
 * No real user data, secrets, private keys, or live network calls are used.
 */

/** Minimal shape a registrable scenario must satisfy. */
export interface RegistrableScenario {
  /** Unique identifier for the scenario. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Optional longer description. */
  description?: string;
}

/** How {@link ScenarioRegistry.merge} resolves duplicate ids. */
export type MergeStrategy = "error" | "skip" | "overwrite";

/** Raised when a scenario is registered with an id that already exists. */
export class ScenarioConflictError extends Error {
  constructor(public readonly id: string) {
    super(`Scenario with id "${id}" is already registered`);
    this.name = "ScenarioConflictError";
  }
}

/**
 * In-memory registry of demo scenarios keyed by their unique id.
 *
 * Insertion order is preserved so that {@link ScenarioRegistry.list} output is
 * deterministic.
 */
export class ScenarioRegistry<T extends RegistrableScenario = RegistrableScenario> {
  private readonly scenarios = new Map<string, T>();

  constructor(initial: readonly T[] = []) {
    this.registerAll(initial);
  }

  /** Number of registered scenarios. */
  get size(): number {
    return this.scenarios.size;
  }

  /** Returns true when a scenario with the given id is registered. */
  has(id: string): boolean {
    return this.scenarios.has(id);
  }

  /** Loads a scenario by id, or undefined when it is not registered. */
  get(id: string): T | undefined {
    return this.scenarios.get(id);
  }

  /** Returns all scenarios in registration order. */
  list(): T[] {
    return [...this.scenarios.values()];
  }

  /** Returns all registered ids in registration order. */
  ids(): string[] {
    return [...this.scenarios.keys()];
  }

  /**
   * Registers a single scenario.
   *
   * @throws {ScenarioConflictError} when the id is already registered.
   */
  register(scenario: T): this {
    if (this.scenarios.has(scenario.id)) {
      throw new ScenarioConflictError(scenario.id);
    }
    this.scenarios.set(scenario.id, scenario);
    return this;
  }

  /**
   * Registers many scenarios. Conflicts within the input or against existing
   * entries throw before anything is added, leaving the registry unchanged.
   */
  registerAll(scenarios: readonly T[]): this {
    const conflicts = this.detectConflicts(scenarios);
    if (conflicts.length > 0) {
      throw new ScenarioConflictError(conflicts[0]);
    }
    for (const scenario of scenarios) {
      this.scenarios.set(scenario.id, scenario);
    }
    return this;
  }

  /**
   * Returns the ids in `scenarios` that conflict either with each other or
   * with already-registered scenarios. The result is de-duplicated and in
   * order of first appearance.
   */
  detectConflicts(scenarios: readonly T[]): string[] {
    const seen = new Set<string>();
    const conflicts: string[] = [];
    for (const scenario of scenarios) {
      const duplicate = seen.has(scenario.id) || this.scenarios.has(scenario.id);
      if (duplicate && !conflicts.includes(scenario.id)) {
        conflicts.push(scenario.id);
      }
      seen.add(scenario.id);
    }
    return conflicts;
  }

  /**
   * Merges scenarios into this registry using the given strategy:
   * - "error": throw on the first conflicting id, changing nothing (default)
   * - "skip": keep the existing scenario, ignore the incoming one
   * - "overwrite": replace the existing scenario with the incoming one
   *
   * Returns the ids that conflicted (useful for "skip"/"overwrite").
   */
  merge(scenarios: readonly T[], strategy: MergeStrategy = "error"): string[] {
    if (strategy === "error") {
      const conflicts = this.detectConflicts(scenarios);
      if (conflicts.length > 0) {
        throw new ScenarioConflictError(conflicts[0]);
      }
      for (const scenario of scenarios) {
        this.scenarios.set(scenario.id, scenario);
      }
      return [];
    }

    const conflicts: string[] = [];
    for (const scenario of scenarios) {
      if (this.scenarios.has(scenario.id)) {
        if (!conflicts.includes(scenario.id)) {
          conflicts.push(scenario.id);
        }
        if (strategy === "skip") {
          continue;
        }
      }
      this.scenarios.set(scenario.id, scenario);
    }
    return conflicts;
  }

  /** Removes all registered scenarios. */
  clear(): void {
    this.scenarios.clear();
  }
}

/** Convenience factory mirroring the class constructor. */
export function createScenarioRegistry<T extends RegistrableScenario = RegistrableScenario>(
  initial: readonly T[] = [],
): ScenarioRegistry<T> {
  return new ScenarioRegistry<T>(initial);
}
