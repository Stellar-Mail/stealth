/**
 * types.ts — Components (non-UI execution contract)
 *
 * Domain types for a reusable component registry. No imports from the main app;
 * presentation-free.
 */

/** A normalized component descriptor returned by the contract. */
export interface ComponentDescriptor {
  /** Stable component id. */
  id: string;
  /** Display name. */
  name: string;
  /** Declared props (name -> type). */
  props: Record<string, string>;
  /** Whether the component is enabled/available. */
  enabled: boolean;
}

/** Input for resolving a component by id. */
export interface ResolveComponentInput {
  /** Component id to resolve. */
  id: string;
  /** Optional prop overrides to validate/merge (name -> value). */
  props?: Record<string, unknown>;
}

/** A registered component definition (the registry entry). */
export interface ComponentDefinition {
  id: string;
  name: string;
  props: Record<string, string>;
  enabled?: boolean;
}
