import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";

describe("shared ui/button variants", () => {
  it("applies primary styling by default for shadcn-style actions (success path)", () => {
    const classes = buttonVariants();
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
  });

  it("supports destructive and outline variants for confirmation flows", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
    expect(buttonVariants({ variant: "outline" })).toContain("border-input");
  });

  it("keeps disabled buttons non-interactive", () => {
    const classes = buttonVariants({ variant: "ghost" });
    expect(classes).toContain("disabled:pointer-events-none");
    expect(classes).toContain("disabled:opacity-50");
  });

  it("rejects unknown variant values at compile time (edge case)", () => {
    // @ts-expect-error — feature code should only use documented variants
    const classes = buttonVariants({ variant: "premium" });
    expect(classes).toContain("inline-flex");
    expect(classes).not.toContain("bg-primary");
  });
});
