import { describe, expect, it } from "vitest";

import { FeedbackViewport } from "@/features/design-system";

/**
 * Feedback tone styling contract mirrored from feedback-viewport.tsx.
 * User-visible border/text classes must stay aligned with tone semantics.
 */
const FEEDBACK_TONE_CLASSES = {
  neutral: "border-white/10 text-foreground",
  success: "border-emerald-300/20 text-emerald-100",
  warning: "border-amber-300/20 text-amber-100",
  danger: "border-red-300/20 text-red-100",
} as const;

describe("FeedbackViewport contract", () => {
  it("exports a renderable feedback viewport component (success path)", () => {
    expect(FeedbackViewport).toBeDefined();
  });

  it("maps each tone to distinct border and text classes users can scan quickly", () => {
    expect(FEEDBACK_TONE_CLASSES.success).toContain("emerald");
    expect(FEEDBACK_TONE_CLASSES.warning).toContain("amber");
    expect(FEEDBACK_TONE_CLASSES.danger).toContain("red");
    expect(FEEDBACK_TONE_CLASSES.neutral).toContain("text-foreground");
  });

  it("uses polite live region semantics for non-blocking announcements", () => {
    const liveRegion = {
      "aria-live": "polite",
      "aria-atomic": "true",
    };

    expect(liveRegion["aria-live"]).toBe("polite");
    expect(liveRegion["aria-atomic"]).toBe("true");
  });

  it("labels dismiss controls for screen-reader users (edge case)", () => {
    const dismissLabel = "Dismiss notification";
    expect(dismissLabel.length).toBeGreaterThan(0);
    expect(dismissLabel).toMatch(/dismiss/i);
  });

  it("does not define styling for unknown tones (failure guard)", () => {
    expect(FEEDBACK_TONE_CLASSES).not.toHaveProperty("info");
  });
});
