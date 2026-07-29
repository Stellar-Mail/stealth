import { describe, expect, it } from "vitest";

import { failureFixtures, successFixtures } from "../services/fixtures";
import { safeExtractTasks } from "../services/guards";
import type {
  TaskConfidence,
  TaskExtractionErrorCode,
  TaskPriority,
  TaskTrigger,
} from "../types/taskExtractor";

describe("Success Fixtures", () => {
  it("validates fixture structure matches the SuccessFixture interface", () => {
    for (const fixture of successFixtures) {
      expect(typeof fixture.name).toBe("string");
      expect(fixture.name.length).toBeGreaterThan(0);
      expect(typeof fixture.input).toBe("object");
      expect(typeof fixture.input.messageId).toBe("string");
      expect(Array.isArray(fixture.expectedTaskTexts)).toBe(true);
    }
  });

  it("all success fixtures produce ok status", () => {
    for (const fixture of successFixtures) {
      const outcome = safeExtractTasks(fixture.input);
      expect(outcome.status, `${fixture.name} should succeed`).toBe("ok");
    }
  });

  it("all success fixtures have unique names", () => {
    const names = successFixtures.map((f) => f.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("explicit-requests fixture extracts request phrases", () => {
    const fixture = successFixtures.find((f) => f.name === "explicit-requests");
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const outcome = safeExtractTasks(fixture.input);
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result.tasks).toHaveLength(2);
      expect(outcome.result.tasks.every((t) => t.trigger === "request-phrase")).toBe(true);
      expect(outcome.result.tasks.every((t) => t.confidence === "high")).toBe(true);
    }
  });

  it("checkbox-and-bullet-list fixture extracts mixed formats", () => {
    const fixture = successFixtures.find((f) => f.name === "checkbox-and-bullet-list");
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const outcome = safeExtractTasks(fixture.input);
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result.tasks).toHaveLength(2);
      const triggers = outcome.result.tasks.map((t) => t.trigger);
      expect(triggers).toContain("checkbox");
      expect(triggers).toContain("bullet-action");
    }
  });

  it("urgent-request-with-relative-due fixture resolves dates", () => {
    const fixture = successFixtures.find((f) => f.name === "urgent-request-with-relative-due");
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const outcome = safeExtractTasks(fixture.input);
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result.tasks.length).toBeGreaterThan(0);
      const taskWithDue = outcome.result.tasks.find((t) => t.dueAtHint);
      expect(taskWithDue).toBeDefined();
      expect(taskWithDue?.dueAtHint).toBe("2026-07-04"); // tomorrow from 2026-07-03
      const highPriorityTask = outcome.result.tasks.find((t) => t.priority === "high");
      expect(highPriorityTask).toBeDefined();
    }
  });

  it("no-tasks-found fixture returns empty array without error", () => {
    const fixture = successFixtures.find((f) => f.name === "no-tasks-found");
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const outcome = safeExtractTasks(fixture.input);
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result.tasks).toEqual([]);
      expect(outcome.result.stats.extractedCount).toBe(0);
      expect(outcome.result.stats.lineCount).toBeGreaterThan(0);
    }
  });
});

describe("Failure Fixtures", () => {
  it("validates fixture structure matches the FailureFixture interface", () => {
    for (const fixture of failureFixtures) {
      expect(typeof fixture.name).toBe("string");
      expect(fixture.name.length).toBeGreaterThan(0);
      expect(fixture.input).toBeDefined();
      expect(typeof fixture.expectedCode).toBe("string");
    }
  });

  it("all failure fixtures produce error status", () => {
    for (const fixture of failureFixtures) {
      const outcome = safeExtractTasks(fixture.input);
      expect(outcome.status, `${fixture.name} should fail`).toBe("error");
    }
  });

  it("all failure fixtures have unique names", () => {
    const names = failureFixtures.map((f) => f.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("each failure fixture returns the expected error code", () => {
    for (const fixture of failureFixtures) {
      const outcome = safeExtractTasks(fixture.input);
      if (outcome.status === "error") {
        expect(outcome.code, `${fixture.name} error code`).toBe(fixture.expectedCode);
        expect(outcome.issues.length, `${fixture.name} has issues`).toBeGreaterThan(0);
        expect(typeof outcome.message).toBe("string");
      }
    }
  });

  it("missing-body fixture fails with invalid-input", () => {
    const fixture = failureFixtures.find((f) => f.name === "missing-body");
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const outcome = safeExtractTasks(fixture.input);
    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.code).toBe("invalid-input");
    }
  });

  it("oversized-body fixture fails with input-too-large", () => {
    const fixture = failureFixtures.find((f) => f.name === "oversized-body");
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const outcome = safeExtractTasks(fixture.input);
    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.code).toBe("input-too-large");
      expect(outcome.issues.some((i) => i.field === "body")).toBe(true);
    }
  });

  it("empty-content fixture fails with empty-content", () => {
    const fixture = failureFixtures.find((f) => f.name === "empty-content");
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const outcome = safeExtractTasks(fixture.input);
    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.code).toBe("empty-content");
    }
  });

  it("unsupported-language fixture fails with unsupported-language", () => {
    const fixture = failureFixtures.find((f) => f.name === "unsupported-language");
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const outcome = safeExtractTasks(fixture.input);
    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.code).toBe("unsupported-language");
      expect(outcome.issues.some((i) => i.field === "language")).toBe(true);
    }
  });
});

describe("Fixture Coverage", () => {
  it("covers all error codes except invalid-options", () => {
    // invalid-options is tested separately since it's an options error, not input error
    const errorCodes: TaskExtractionErrorCode[] = [
      "invalid-input",
      "input-too-large",
      "empty-content",
      "unsupported-language",
    ];

    const coveredCodes = new Set(failureFixtures.map((f) => f.expectedCode));
    for (const code of errorCodes) {
      expect(coveredCodes.has(code), `Error code ${code} should be covered`).toBe(true);
    }
  });

  it("covers invalid-options error code separately", () => {
    const outcome = safeExtractTasks(
      { messageId: "test", subject: "", body: "test" },
      { maxTasks: -5 },
    );
    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.code).toBe("invalid-options");
    }
  });

  it("covers all task triggers", () => {
    const triggers: TaskTrigger[] = [
      "checkbox",
      "request-phrase",
      "bullet-action",
      "imperative-line",
    ];
    const allTasks = successFixtures.flatMap((f) => {
      const outcome = safeExtractTasks(f.input);
      return outcome.status === "ok" ? outcome.result.tasks : [];
    });

    const coveredTriggers = new Set(allTasks.map((t) => t.trigger));
    for (const trigger of triggers) {
      expect(coveredTriggers.has(trigger), `Trigger ${trigger} should be covered`).toBe(true);
    }
  });

  it("covers all confidence levels", () => {
    const confidenceLevels: TaskConfidence[] = ["low", "medium", "high"];
    const allTasks = successFixtures.flatMap((f) => {
      const outcome = safeExtractTasks(f.input);
      return outcome.status === "ok" ? outcome.result.tasks : [];
    });

    const coveredConfidence = new Set(allTasks.map((t) => t.confidence));
    for (const level of confidenceLevels) {
      expect(coveredConfidence.has(level), `Confidence ${level} should be covered`).toBe(true);
    }
  });

  it("covers all priority levels", () => {
    const priorities: TaskPriority[] = ["low", "normal", "high"];
    const allTasks = successFixtures.flatMap((f) => {
      const outcome = safeExtractTasks(f.input);
      return outcome.status === "ok" ? outcome.result.tasks : [];
    });

    const coveredPriorities = new Set(allTasks.map((t) => t.priority));
    for (const priority of priorities) {
      expect(coveredPriorities.has(priority), `Priority ${priority} should be covered`).toBe(true);
    }
  });
});
