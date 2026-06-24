import { describe, expect, it } from "vitest";
import {
  ADMIN_EMPTY_STATE_KINDS,
  ADMIN_EMPTY_STATE_PRESETS,
  getAdminEmptyStatePreset,
} from "../constants/adminEmptyStates";

describe("admin empty state presets", () => {
  it("covers all required panels", () => {
    expect(ADMIN_EMPTY_STATE_KINDS).toEqual([
      "messages",
      "senders",
      "attachments",
      "events",
      "validation",
      "kpis",
    ]);
    expect(Object.keys(ADMIN_EMPTY_STATE_PRESETS).sort()).toEqual(
      [...ADMIN_EMPTY_STATE_KINDS].sort(),
    );
  });

  it("provides non-empty title and description for each kind", () => {
    for (const kind of ADMIN_EMPTY_STATE_KINDS) {
      const copy = getAdminEmptyStatePreset(kind);
      expect(copy.title.trim().length).toBeGreaterThan(0);
      expect(copy.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("returns the matching preset object", () => {
    expect(getAdminEmptyStatePreset("messages")).toBe(ADMIN_EMPTY_STATE_PRESETS.messages);
    expect(getAdminEmptyStatePreset("validation").title).toBe("No validation results yet");
  });
});
