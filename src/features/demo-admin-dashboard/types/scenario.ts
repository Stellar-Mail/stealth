import type { Draft } from "./draft";

/**
 * Controls how a scenario's draft is applied to the current draft state.
 * - "replace": discard the current draft and load the scenario draft as-is.
 * - "merge": keep the current draft and overlay the scenario's fields.
 */
export type ScenarioLoadMode = "replace" | "merge";

/**
 * A self-contained demo scenario that can be loaded into the compose draft.
 * All scenario data must stay fake, deterministic, and safe for public review.
 */
export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  draft: Draft;
}

/**
 * Read-only registry of demo scenarios keyed by id.
 */
export interface ScenarioRegistry {
  list(): DemoScenario[];
  get(id: string): DemoScenario | undefined;
  has(id: string): boolean;
}
