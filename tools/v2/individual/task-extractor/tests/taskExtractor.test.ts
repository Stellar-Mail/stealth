import { describe, expect, it } from "vitest";

import {
  extractTasks,
  DEFAULT_MAX_TASKS,
  MAX_TASKS_LIMIT,
  MAX_TASK_TEXT_CHARS,
  resolveMaxTasks,
} from "../services/taskExtractor";
import { successFixtures } from "../services/fixtures";
import type { TaskExtractionInput } from "../types/taskExtractor";

function makeInput(overrides: Partial<TaskExtractionInput> = {}): TaskExtractionInput {
  return {
    messageId: "msg-test-001",
    subject: "",
    body: "",
    ...overrides,
  };
}

describe("extractTasks", () => {
  it("extracts the expected tasks from each success fixture", () => {
    for (const fixture of successFixtures) {
      const result = extractTasks(fixture.input);
      expect(
        result.tasks.map((task) => task.text),
        fixture.name,
      ).toEqual(fixture.expectedTaskTexts);
      expect(result.messageId).toBe(fixture.input.messageId);
    }
  });

  it("assigns deterministic sequential task ids", () => {
    const result = extractTasks(
      makeInput({ body: "Please review the deck.\nPlease send the notes." }),
    );
    expect(result.tasks.map((task) => task.id)).toEqual([
      "msg-test-001-task-1",
      "msg-test-001-task-2",
    ]);
  });

  it("treats checkbox items as high-confidence tasks", () => {
    const result = extractTasks(makeInput({ body: "- [ ] Book the venue" }));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      text: "Book the venue",
      trigger: "checkbox",
      confidence: "high",
      source: "body",
    });
  });

  it("captures the requested action from request phrases", () => {
    const result = extractTasks(
      makeInput({ body: "Could you please share the meeting notes with the team?" }),
    );
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      text: "share the meeting notes with the team",
      trigger: "request-phrase",
      confidence: "high",
    });
  });

  it("keeps action-verb bullets and drops non-action bullets", () => {
    const result = extractTasks(makeInput({ body: "- schedule the retro\n- cake for the party" }));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      text: "schedule the retro",
      trigger: "bullet-action",
      confidence: "medium",
    });
  });

  it("flags bare imperative lines with low confidence", () => {
    const result = extractTasks(makeInput({ body: "Send the invoice to the client" }));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      trigger: "imperative-line",
      confidence: "low",
    });
  });

  it("filters below minConfidence without changing stronger tasks", () => {
    const body = "Send the invoice to the client\n- [ ] Book the venue";
    const all = extractTasks(makeInput({ body }));
    const filtered = extractTasks(makeInput({ body }), { minConfidence: "medium" });
    expect(all.tasks).toHaveLength(2);
    expect(filtered.tasks).toHaveLength(1);
    expect(filtered.tasks[0].text).toBe("Book the venue");
    expect(filtered.stats.candidateCount).toBe(2);
  });

  it("detects high and low priority from surrounding language", () => {
    const urgent = extractTasks(makeInput({ body: "Please fix the login bug, it is urgent." }));
    const relaxed = extractTasks(makeInput({ body: "Please update the wiki, no rush at all." }));
    const plain = extractTasks(makeInput({ body: "Please confirm the booking." }));
    expect(urgent.tasks[0].priority).toBe("high");
    expect(relaxed.tasks[0].priority).toBe("low");
    expect(plain.tasks[0].priority).toBe("normal");
  });

  it("resolves ISO dates into dueAtHint and rejects impossible dates", () => {
    const dated = extractTasks(makeInput({ body: "Please submit the report by 2026-08-15." }));
    const bogus = extractTasks(makeInput({ body: "Please submit the report by 2026-13-40." }));
    expect(dated.tasks[0].dueAtHint).toBe("2026-08-15");
    expect(bogus.tasks[0].dueAtHint).toBeUndefined();
  });

  it("resolves relative due phrases only when receivedAt is present", () => {
    const withReceived = extractTasks(
      makeInput({
        body: "Please pay the invoice by tomorrow.",
        receivedAt: "2026-07-03T08:00:00.000Z",
      }),
    );
    const withoutReceived = extractTasks(
      makeInput({ body: "Please pay the invoice by tomorrow." }),
    );
    expect(withReceived.tasks[0].dueAtHint).toBe("2026-07-04");
    expect(withReceived.tasks[0].dueTextHint).toBeUndefined();
    expect(withoutReceived.tasks[0].dueAtHint).toBeUndefined();
    expect(withoutReceived.tasks[0].dueTextHint).toBe("tomorrow");
  });

  it("keeps weekday due phrases as text hints", () => {
    const result = extractTasks(
      makeInput({
        body: "Please draft the summary by Friday.",
        receivedAt: "2026-07-03T08:00:00.000Z",
      }),
    );
    expect(result.tasks[0].dueAtHint).toBeUndefined();
    expect(result.tasks[0].dueTextHint).toBe("friday");
  });

  it("deduplicates repeated task texts case-insensitively", () => {
    const result = extractTasks(
      makeInput({ body: "Please review the deck.\nplease Review The Deck." }),
    );
    expect(result.tasks).toHaveLength(1);
    expect(result.stats.candidateCount).toBe(2);
  });

  it("truncates to maxTasks and reports it in stats", () => {
    const body = [
      "Please review the deck.",
      "Please send the notes.",
      "Please book the room.",
    ].join("\n");
    const result = extractTasks(makeInput({ body }), { maxTasks: 2 });
    expect(result.tasks).toHaveLength(2);
    expect(result.stats).toMatchObject({
      candidateCount: 3,
      extractedCount: 2,
      truncated: true,
    });
  });

  it("cuts overlong task text at a word boundary", () => {
    const longTail = "review " + "spreadsheet ".repeat(40);
    const result = extractTasks(makeInput({ body: `Please ${longTail}` }));
    const text = result.tasks[0].text;
    expect(text.length).toBeLessThanOrEqual(MAX_TASK_TEXT_CHARS);
    expect(text.endsWith("spreadsheet")).toBe(true);
  });

  it("returns an empty task list with stats when nothing matches", () => {
    const result = extractTasks(
      makeInput({ subject: "Weekly notes", body: "It was a quiet week." }),
    );
    expect(result.tasks).toEqual([]);
    expect(result.stats).toEqual({
      lineCount: 2,
      candidateCount: 0,
      extractedCount: 0,
      truncated: false,
    });
  });

  it("is deterministic for identical input", () => {
    const input = makeInput({
      subject: "Action required: renew the certificate",
      body: "Please renew the TLS certificate by 2026-08-01.",
      receivedAt: "2026-07-03T08:00:00.000Z",
    });
    expect(extractTasks(input)).toEqual(extractTasks(input));
  });

  it("does not mutate the caller's input", () => {
    const input = makeInput({ subject: "Sprint prep", body: "- [ ] Update the roadmap deck" });
    const snapshot = JSON.parse(JSON.stringify(input));
    extractTasks(input);
    expect(input).toEqual(snapshot);
  });
});

describe("resolveMaxTasks", () => {
  it("defaults when undefined and clamps out-of-range values", () => {
    expect(resolveMaxTasks(undefined)).toBe(DEFAULT_MAX_TASKS);
    expect(resolveMaxTasks(0)).toBe(1);
    expect(resolveMaxTasks(7.9)).toBe(7);
    expect(resolveMaxTasks(1000)).toBe(MAX_TASKS_LIMIT);
  });
});
