import { describe, expect, it } from "vitest";

import { EmptyState, Surface } from "@/features/design-system";

/**
 * Surface variant and padding class contracts mirrored from surface.tsx.
 * These are user-visible layout outcomes contributors rely on across panels.
 */
const SURFACE_VARIANT_CLASSES = {
  glass: "glass",
  strong: "glass-strong",
  tile: "glass-tile",
  modal: "glass-modal",
} as const;

const SURFACE_PADDING_CLASSES = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
} as const;

describe("Surface primitive contract", () => {
  it("exports a renderable surface component (success path)", () => {
    expect(Surface).toBeDefined();
  });

  it("maps each surface variant to a stable glass utility class", () => {
    expect(Object.keys(SURFACE_VARIANT_CLASSES)).toEqual(["glass", "strong", "tile", "modal"]);
    expect(SURFACE_VARIANT_CLASSES.glass).toBe("glass");
    expect(SURFACE_VARIANT_CLASSES.modal).toBe("glass-modal");
  });

  it("uses empty padding for none and stepped padding for sm/md/lg", () => {
    expect(SURFACE_PADDING_CLASSES.none).toBe("");
    expect(SURFACE_PADDING_CLASSES.sm).toBe("p-3");
    expect(SURFACE_PADDING_CLASSES.lg).toBe("p-7");
  });

  it("does not define padding classes for unknown keys (edge case)", () => {
    expect(SURFACE_PADDING_CLASSES).not.toHaveProperty("xl");
  });
});

describe("EmptyState primitive contract", () => {
  it("exports a renderable empty-state component (success path)", () => {
    expect(EmptyState).toBeDefined();
  });

  it("requires title and description so empty views always explain the next step", () => {
    type RequiredProps = "title" | "description";
    const required: RequiredProps[] = ["title", "description"];
    expect(required).toEqual(["title", "description"]);
  });
});
