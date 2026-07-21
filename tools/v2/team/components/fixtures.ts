/**
 * fixtures.ts — Components (execution contract fixtures)
 *
 * Deterministic local fixtures used by the contract tests and as documentation
 * of the contract shape.
 */

import type { ComponentDefinition } from "./types";

/** A small deterministic component registry. */
export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    id: "button",
    name: "Button",
    props: { label: "string", variant: "string", disabled: "boolean" },
    enabled: true,
  },
  {
    id: "modal",
    name: "Modal",
    props: { title: "string", open: "boolean" },
    enabled: true,
  },
  {
    id: "legacy-banner",
    name: "Legacy Banner",
    props: { message: "string" },
    enabled: false,
  },
];
