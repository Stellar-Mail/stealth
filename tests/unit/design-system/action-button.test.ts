import { describe, expect, it } from "vitest";

import { actionButtonVariants } from "@/features/design-system";

describe("actionButtonVariants", () => {
  it("applies primary intent and medium size by default (success path)", () => {
    const classes = actionButtonVariants();
    expect(classes).toContain("bg-white");
    expect(classes).toContain("text-zinc-950");
    expect(classes).toContain("h-10");
  });

  it("maps danger intent to destructive styling users can recognize", () => {
    const classes = actionButtonVariants({ intent: "danger" });
    expect(classes).toContain("text-red-100");
    expect(classes).toContain("border-red-300/20");
  });

  it("supports compact and icon-only sizes for dense toolbars", () => {
    expect(actionButtonVariants({ size: "sm" })).toContain("h-8");
    expect(actionButtonVariants({ size: "icon" })).toContain("size-10");
  });

  it("keeps disabled controls inert for keyboard and pointer users", () => {
    const classes = actionButtonVariants({ intent: "secondary" });
    expect(classes).toContain("disabled:pointer-events-none");
    expect(classes).toContain("disabled:opacity-45");
  });

  it("rejects unknown intent values at compile time and returns base classes at runtime (edge case)", () => {
    // @ts-expect-error — invalid intents must not compile in feature code
    const classes = actionButtonVariants({ intent: "outline" });
    expect(classes).toContain("glow-ring");
    expect(classes).not.toContain("bg-white");
  });
});
