/**
 * components.service.ts — Components (non-UI service)
 *
 * Presentation-free service boundary for the components contract. Wraps the
 * pure `ComponentRegistry` / `createComponentsContract` reducer into a single
 * factory entry point.
 */

import { createComponentsContract, type ComponentsContract } from "../contract";
import type { ComponentDefinition } from "../types";

/** Build the components execution contract (service entry point). */
export function createComponentsService(defs: ComponentDefinition[] = []): ComponentsContract {
  return createComponentsContract(defs);
}
