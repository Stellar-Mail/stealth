import { describe, expect, it } from "vitest";

import { cleanGrammar, toReadyState, type GrammarInput } from "../services/grammarCleaner";
import { EMPTY_TEXT_INPUT, SAMPLE_TEXTS } from "../services/fixtures";
import {
  checkInputLimits,
  GUARD_LIMITS,
  safeCleanGrammar,
  sanitizeGrammarInput,
  sanitizeText,
} from "../services/guards";

const sampleText = SAMPLE_TEXTS[0].input;

describe("cleanGrammar", () => {
  it("detects and corrects homophone errors without dropping following words", () => {
    const result = cleanGrammar(sampleText);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.result.changed).toBe(true);
    expect(result.result.issueCount).toBeGreaterThan(0);
    expect(result.result.correctedText).toContain("they're going");
    expect(result.result.correctedText).toContain("You're the best");
    expect(result.result.correctedText).toContain("it's important");
    expect(result.result.correctedText).not.toContain("there going");
  });

  it("capitalizes 'i' to 'I'", () => {
    const result = cleanGrammar({ bodyText: "i think this is correct." });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.result.correctedText.startsWith("I")).toBe(true);
    expect(result.result.issueCount).toBeGreaterThan(0);
  });

  it("detects and removes filler words", () => {
    const result = cleanGrammar({
      bodyText: "I just wanted to basically say hello.",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.result.correctedText).not.toContain("just");
    expect(result.result.correctedText).not.toContain("basically");
    expect(result.result.changed).toBe(true);
  });

  it("preserves captured words in their/there/your corrections", () => {
    const result = cleanGrammar({
      bodyText: "Their ready now. There working late. Your welcome to join.",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.result.correctedText).toBe(
      "They're ready now. They're working late. You're welcome to join.",
    );
  });

  it("fixes punctuation spacing", () => {
    const result = cleanGrammar({
      bodyText: "Please send the report , the invoice .",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.result.issueCount).toBeGreaterThan(0);
  });

  it("returns no issues for clean text", () => {
    const result = cleanGrammar({ bodyText: "The meeting is at three o'clock." });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.result.issueCount).toBe(0);
    expect(result.result.changed).toBe(false);
  });

  it("returns an error for empty body", () => {
    const result = cleanGrammar(EMPTY_TEXT_INPUT);
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("empty-body");
  });

  it("returns an error for unsupported input", () => {
    const result = cleanGrammar({} as GrammarInput);
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("unsupported-input");
  });

  it("is deterministic for the same input", () => {
    expect(cleanGrammar(sampleText)).toEqual(cleanGrammar(sampleText));
  });

  it("processes all sample fixtures without error", () => {
    for (const fixture of SAMPLE_TEXTS) {
      expect(cleanGrammar(fixture.input).status).toBe("ok");
    }
  });
});

describe("toReadyState", () => {
  it("maps ok result to ready", () => {
    const ok = cleanGrammar(sampleText);
    const state = toReadyState(ok);
    expect(state.status).toBe("ready");
  });

  it("maps error result to error", () => {
    const err = cleanGrammar(EMPTY_TEXT_INPUT);
    const state = toReadyState(err);
    expect(state.status).toBe("error");
    if (state.status !== "error") return;
    expect(state.code).toBe("empty-body");
  });
});

describe("guards", () => {
  it("sanitizes control characters from text", () => {
    expect(sanitizeText("hello\u0000world")).toBe("helloworld");
  });

  it("sanitizes grammar input text fields", () => {
    const input = { bodyText: "hello\u200bworld" };
    const sanitized = sanitizeGrammarInput(input);
    expect(sanitized.bodyText).toBe("helloworld");
  });

  it("rejects body exceeding max chars", () => {
    const issue = checkInputLimits({
      bodyText: "x".repeat(GUARD_LIMITS.maxBodyChars + 1),
    });
    expect(issue).not.toBeNull();
    expect(issue!.code).toBe("input-too-large");
  });

  it("passes input within limits", () => {
    const issue = checkInputLimits({ bodyText: "small text" });
    expect(issue).toBeNull();
  });

  it("safeCleanGrammar delegates to engine for valid input", () => {
    const result = safeCleanGrammar({ bodyText: "i have a typo" });
    expect(result.status).toBe("ok");
  });

  it("safeCleanGrammar rejects oversized input before engine runs", () => {
    const result = safeCleanGrammar({ bodyText: "x".repeat(GUARD_LIMITS.maxBodyChars + 1) });
    if (result.status !== "error") return;
    expect(result.code).toBe("input-too-large");
  });
});
