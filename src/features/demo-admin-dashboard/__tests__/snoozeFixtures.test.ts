import { describe, expect, it } from "vitest";
import { getDemoNow } from "../snooze/referenceNow";
import { snoozedDemoMessages } from "../snooze/snoozeFixtures";
import { toLocalStamp } from "../snooze/snoozeValidation";

const now = getDemoNow();

describe("snoozedDemoMessages fixtures", () => {
  it("have unique ids", () => {
    const ids = snoozedDemoMessages.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("use only safe, fake demo addresses", () => {
    for (const message of snoozedDemoMessages) {
      expect(message.email).toMatch(/(\*stealth\.demo|@example\.(com|org))$/);
    }
  });

  it("store valid local stamps that are in the future and round-trip", () => {
    for (const message of snoozedDemoMessages) {
      const remindAt = new Date(message.snooze.remindAt);
      expect(Number.isNaN(remindAt.getTime())).toBe(false);
      expect(remindAt.getTime()).toBeGreaterThan(now.getTime());
      // The stored stamp is already in local `yyyy-MM-ddTHH:mm` form.
      expect(toLocalStamp(remindAt)).toBe(message.snooze.remindAt);
    }
  });
});
