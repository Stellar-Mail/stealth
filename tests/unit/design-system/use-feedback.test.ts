import { describe, expect, it } from "vitest";

import type { FeedbackItem, FeedbackTone } from "@/features/design-system";

/**
 * Pure state-machine simulation of useFeedback queue behavior.
 * Mirrors the hook contract without mounting React.
 */
type FeedbackQueue = FeedbackItem[];

function enqueue(
  queue: FeedbackQueue,
  message: string,
  tone: FeedbackTone = "neutral",
): { queue: FeedbackQueue; id: string } {
  const id = `feedback-test-${queue.length}`;
  return {
    id,
    queue: [...queue, { id, message, tone }],
  };
}

function dismiss(queue: FeedbackQueue, id: string): FeedbackQueue {
  return queue.filter((item) => item.id !== id);
}

describe("useFeedback queue contract", () => {
  it("queues a neutral notification by default (success path)", () => {
    const { queue, id } = enqueue([], "Draft saved locally.");
    expect(queue).toHaveLength(1);
    expect(queue[0]).toEqual({
      id,
      message: "Draft saved locally.",
      tone: "neutral",
    });
  });

  it("preserves explicit warning and danger tones for recovery copy", () => {
    const warning = enqueue([], "Relay unreachable. Retry when online.", "warning");
    const danger = enqueue(warning.queue, "Could not verify sender.", "danger");

    expect(danger.queue.map((item) => item.tone)).toEqual(["warning", "danger"]);
  });

  it("removes a dismissed item while leaving other notifications intact", () => {
    const first = enqueue([], "Syncing preferences.");
    const second = enqueue(first.queue, "Preferences synced.", "success");
    const afterDismiss = dismiss(second.queue, first.id);

    expect(afterDismiss).toHaveLength(1);
    expect(afterDismiss[0]?.message).toBe("Preferences synced.");
  });

  it("ignores dismiss calls for unknown ids without dropping active items (edge case)", () => {
    const seeded = enqueue([], "Still here.");
    const afterUnknownDismiss = dismiss(seeded.queue, "missing-id");
    expect(afterUnknownDismiss).toEqual(seeded.queue);
  });

  it("does not mutate the previous queue when enqueueing (failure guard)", () => {
    const original: FeedbackQueue = [];
    const { queue: next } = enqueue(original, "New toast.");
    expect(original).toHaveLength(0);
    expect(next).toHaveLength(1);
  });
});
