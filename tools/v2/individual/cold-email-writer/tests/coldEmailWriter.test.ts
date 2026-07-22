import { describe, expect, it } from "vitest";

import { failureFixtures, safeWriteColdEmail, successFixtures, writeColdEmail } from "../index";

describe("safeWriteColdEmail", () => {
  it("executes every success fixture", () => {
    for (const fixture of successFixtures) {
      const outcome = safeWriteColdEmail(fixture.input, fixture.options);
      expect(outcome.status, fixture.name).toBe("ok");
      if (outcome.status === "ok") {
        expect(outcome.result.requestId).toBe(fixture.input.requestId);
        expect(outcome.result.tone).toBe(fixture.expectedTone);
        expect(outcome.result.metadata.wordCount).toBeGreaterThan(0);
        expect(outcome.result.subject === null).toBe(fixture.options?.includeSubject === false);
      }
    }
  });

  it("returns the expected code for every failure fixture", () => {
    for (const fixture of failureFixtures) {
      const outcome = safeWriteColdEmail(fixture.input, fixture.options);
      expect(outcome.status, fixture.name).toBe("error");
      if (outcome.status === "error") {
        expect(outcome.code, fixture.name).toBe(fixture.expectedCode);
        expect(outcome.issues.length).toBeGreaterThan(0);
      }
    }
  });

  it("never throws for hostile payloads", () => {
    for (const payload of [null, 42, "email", [], { __proto__: { recipient: {} } }]) {
      expect(() => safeWriteColdEmail(payload)).not.toThrow();
      expect(safeWriteColdEmail(payload).status).toBe("error");
    }
  });

  it("sanitizes zero-width characters before writing", () => {
    const input = {
      ...successFixtures[0].input,
      requestId: "  cold-hidden  ",
      recipient: { name: "Jo\u200brdan" },
    };
    const outcome = safeWriteColdEmail(input);
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result.requestId).toBe("cold-hidden");
      expect(outcome.result.body).toContain("Jordan");
    }
  });
});

describe("writeColdEmail", () => {
  it("is deterministic and does not mutate input", () => {
    const input = structuredClone(successFixtures[0].input);
    const snapshot = structuredClone(input);
    expect(writeColdEmail(input)).toEqual(writeColdEmail(input));
    expect(input).toEqual(snapshot);
  });

  it("honors the body word cap", () => {
    const result = writeColdEmail(successFixtures[0].input, { maxBodyWords: 12 });
    expect(result.metadata.wordCount).toBeLessThanOrEqual(12);
  });
});
