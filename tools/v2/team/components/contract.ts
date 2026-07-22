/**
 * contract.ts — Components (non-UI execution contract)
 *
 * Backend-facing execution contract for a reusable component registry. It is
 * presentation-free: no React, no DOM. Operations return a typed
 * `ComponentResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 */

import type { ComponentDefinition, ComponentDescriptor, ResolveComponentInput } from "./types";

/** Explicit, machine-readable error codes for contract operations. */
export enum ComponentErrorCode {
  /** A required field was missing or failed validation. */
  InvalidInput = "INVALID_INPUT",
  /** The requested component id was not found in the registry. */
  ComponentNotFound = "COMPONENT_NOT_FOUND",
}

/** Discriminated outcome returned by every contract operation. */
export type ComponentResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ComponentErrorCode; message: string };

/** Operations supported by the components contract. */
export type ComponentOperation =
  | { operation: "resolve"; input: ResolveComponentInput }
  | { operation: "list" };

/** Output produced by the contract, keyed by operation. */
export type ComponentContractOutput =
  | { operation: "resolve"; descriptor: ComponentDescriptor }
  | { operation: "list"; descriptors: ComponentDescriptor[] };

/** Backend-facing entry point for the components contract. */
export interface ComponentsContract {
  execute(input: ComponentOperation): ComponentResult<ComponentContractOutput>;
}

/** Typed success outcome. */
export function ok<T>(value: T): ComponentResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: ComponentErrorCode, message: string): ComponentResult<T> {
  return { ok: false, error, message };
}

/** A pure registry of components held in memory. */
export class ComponentRegistry {
  private readonly defs: Map<string, ComponentDefinition>;

  constructor(defs: ComponentDefinition[] = []) {
    this.defs = new Map(defs.map((d) => [d.id, d]));
  }

  resolve(input: ResolveComponentInput): ComponentResult<ComponentDescriptor> {
    if (!input || typeof input.id !== "string" || input.id.trim() === "") {
      return fail(ComponentErrorCode.InvalidInput, "id is required");
    }
    const def = this.defs.get(input.id);
    if (!def) {
      return fail(ComponentErrorCode.ComponentNotFound, `Component not found: ${input.id}`);
    }
    if (input.props) {
      for (const key of Object.keys(input.props)) {
        if (!(key in def.props)) {
          return fail(
            ComponentErrorCode.InvalidInput,
            `Unknown prop "${key}" for component ${def.id}`,
          );
        }
      }
    }
    const descriptor: ComponentDescriptor = {
      id: def.id,
      name: def.name,
      props: def.props,
      enabled: def.enabled ?? true,
    };
    return ok(descriptor);
  }

  list(): ComponentResult<ComponentDescriptor[]> {
    const descriptors: ComponentDescriptor[] = Array.from(this.defs.values()).map((d) => ({
      id: d.id,
      name: d.name,
      props: d.props,
      enabled: d.enabled ?? true,
    }));
    return ok(descriptors);
  }
}

/** Build the components execution contract from a registry of definitions. */
export function createComponentsContract(defs: ComponentDefinition[] = []): ComponentsContract {
  const registry = new ComponentRegistry(defs);
  return {
    execute(input: ComponentOperation): ComponentResult<ComponentContractOutput> {
      try {
        if (input.operation === "resolve") {
          const res = registry.resolve(input.input);
          if (!res.ok) return res;
          return ok({ operation: "resolve", descriptor: res.value });
        }
        if (input.operation === "list") {
          const res = registry.list();
          if (!res.ok) return res;
          return ok({ operation: "list", descriptors: res.value });
        }
        return fail(ComponentErrorCode.InvalidInput, `Unknown operation: ${JSON.stringify(input)}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(ComponentErrorCode.InvalidInput, message);
      }
    },
  };
}
