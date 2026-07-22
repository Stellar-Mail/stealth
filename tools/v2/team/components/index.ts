/**
 * index.ts — Components
 *
 * Folder-local API surface. Exports the non-UI execution contract, its types,
 * and the service factory. Nothing here imports from the main app.
 */

// Types
export type { ComponentDescriptor, ComponentDefinition, ResolveComponentInput } from "./types";

// Contract + service
export { createComponentsService } from "./services/components.service";
export {
  createComponentsContract,
  ComponentRegistry,
  ComponentErrorCode,
  ok,
  fail,
} from "./contract";
export type {
  ComponentsContract,
  ComponentOperation,
  ComponentContractOutput,
  ComponentResult,
} from "./contract";

// Fixtures
export { COMPONENT_DEFINITIONS } from "./fixtures";
