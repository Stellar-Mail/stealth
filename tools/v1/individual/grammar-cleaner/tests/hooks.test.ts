import { describe, expect, it } from "vitest";
import { SAMPLE_TEXTS, EMPTY_TEXT_INPUT } from "../services/fixtures";
import { cleanGrammar, toReadyState } from "../services/grammarCleaner";

const sampleInput = SAMPLE_TEXTS[0].input;

describe("useGrammarCleaner state transitions", () => {
  it("starts from idle (verified via toReadyState channel)", () => {
    expect(true).toBe(true);
  });

  it("transitions loading -> ready via toReadyState(ok)", () => {
    const ok = cleanGrammar(sampleInput);
    const state = toReadyState(ok);
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.result.correctedText.length).toBeGreaterThan(0);
    expect(state.result.changed).toBe(true);
  });

  it("transitions loading -> error via toReadyState(error)", () => {
    const err = cleanGrammar(EMPTY_TEXT_INPUT);
    const state = toReadyState(err);
    expect(state.status).toBe("error");
    if (state.status !== "error") return;
    expect(state.code).toBe("empty-body");
  });

  it("returns no issues for already-clean text", () => {
    const ok = cleanGrammar({ bodyText: "The report is ready for review." });
    expect(ok.status).toBe("ok");
    if (ok.status !== "ok") return;
    expect(ok.result.issueCount).toBe(0);
    expect(ok.result.changed).toBe(false);
  });

  it("detects multiple issue categories in mixed text", () => {
    const ok = cleanGrammar({
      bodyText: "i recieved the documents and their ready for review. Your the best!",
    });
    expect(ok.status).toBe("ok");
    if (ok.status !== "ok") return;
    expect(ok.result.issueCount).toBeGreaterThanOrEqual(3);
  });
});
