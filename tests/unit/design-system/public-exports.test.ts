import { describe, expect, it } from "vitest";

import * as DesignSystem from "@/features/design-system";

describe("design-system public exports", () => {
  it("exports action, surface, and empty-state primitives (success path)", () => {
    expect(DesignSystem.ActionButton).toBeDefined();
    expect(typeof DesignSystem.actionButtonVariants).toBe("function");
    expect(DesignSystem.Surface).toBeDefined();
    expect(DesignSystem.EmptyState).toBeDefined();
  });

  it("exports trust badges and skeleton loading primitives", () => {
    expect(DesignSystem.TrustBadge).toBeDefined();
    expect(DesignSystem.TRUST_STATE_META).toBeDefined();
    expect(DesignSystem.SkeletonBlock).toBeDefined();
    expect(DesignSystem.SkeletonText).toBeDefined();
    expect(DesignSystem.SkeletonAvatar).toBeDefined();
    expect(DesignSystem.SkeletonButton).toBeDefined();
    expect(DesignSystem.MailListSkeleton).toBeDefined();
    expect(DesignSystem.MailReaderSkeleton).toBeDefined();
  });

  it("exports feedback queue helpers", () => {
    expect(DesignSystem.FeedbackViewport).toBeDefined();
    expect(typeof DesignSystem.useFeedback).toBe("function");
  });

  it("does not expose unexpected top-level exports (edge case)", () => {
    const allowed = new Set([
      "ActionButton",
      "actionButtonVariants",
      "EmptyState",
      "Surface",
      "FeedbackViewport",
      "useFeedback",
      "TrustBadge",
      "TRUST_STATE_META",
      "SkeletonBlock",
      "SkeletonText",
      "SkeletonAvatar",
      "SkeletonButton",
      "MailListSkeleton",
      "MailReaderSkeleton",
      "CalendarSkeleton",
      "SettingsSkeleton",
      "RightPanelSkeleton",
    ]);

    for (const key of Object.keys(DesignSystem)) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});
