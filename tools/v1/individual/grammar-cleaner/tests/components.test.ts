import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  GrammarCleanerEmpty,
  GrammarCleanerLoading,
  GrammarCleanerError,
  GrammarCleanerView,
  GrammarCleaner,
} from "../components";
import { SAMPLE_TEXTS } from "../services/fixtures";
import { cleanGrammar } from "../services/grammarCleaner";

const sampleInput = SAMPLE_TEXTS[0].input;
const onChange = () => {};
const onSubmit = () => {};

function isElement(n: unknown): n is ReactElement {
  return (
    typeof n === "object" && n !== null && "type" in n && "props" in (n as Record<string, unknown>)
  );
}

function findInTree(
  node: ReactNode,
  predicate: (el: ReactElement) => boolean,
): ReactElement | null {
  if (!isElement(node)) return null;
  if (predicate(node)) return node;
  const children = node.props.children;
  if (children == null) return null;
  const arr = Array.isArray(children) ? children : [children];
  for (const child of arr) {
    const found = findInTree(child, predicate);
    if (found) return found;
  }
  return null;
}

function hasElement(node: ReactNode, predicate: (el: ReactElement) => boolean): boolean {
  return findInTree(node, predicate) !== null;
}

describe("GrammarCleanerEmpty", () => {
  it("renders idle input section", () => {
    const result = GrammarCleanerEmpty({ value: "", onChange, onSubmit });
    expect(result.type).toBe("section");
  });

  it("renders textarea for input", () => {
    const el = GrammarCleanerEmpty({ value: "", onChange, onSubmit });
    expect(hasElement(el, (n) => n.props.id === "gc-text-input")).toBe(true);
  });

  it("renders submit button disabled when empty", () => {
    const el = GrammarCleanerEmpty({ value: "", onChange, onSubmit });
    expect(hasElement(el, (n) => n.props.type === "button" && n.props.disabled === true)).toBe(
      true,
    );
  });

  it("renders submit button enabled when text present", () => {
    const el = GrammarCleanerEmpty({ value: "some text", onChange, onSubmit });
    expect(hasElement(el, (n) => n.props.type === "button" && n.props.disabled === false)).toBe(
      true,
    );
  });
});

describe("GrammarCleanerLoading", () => {
  it("renders with aria-busy", () => {
    const el = GrammarCleanerLoading();
    expect(el.type).toBe("section");
    expect(el.props["aria-busy"]).toBe("true");
  });
});

describe("GrammarCleanerError", () => {
  const defaultProps = { code: "empty-body", message: "Cannot clean an empty text." };

  it("renders error heading and message", () => {
    const el = GrammarCleanerError(defaultProps);
    expect(hasElement(el, (n) => n.props.children === "Unable to check grammar")).toBe(true);
    expect(hasElement(el, (n) => String(n.props.children).includes("Cannot clean"))).toBe(true);
  });

  it("renders retry button when onRetry provided", () => {
    const el = GrammarCleanerError({ ...defaultProps, onRetry: () => {} });
    expect(hasElement(el, (n) => n.props.type === "button")).toBe(true);
  });

  it("does not render retry button when onRetry omitted", () => {
    const el = GrammarCleanerError(defaultProps);
    expect(hasElement(el, (n) => n.props.type === "button")).toBe(false);
  });
});

describe("GrammarCleanerView", () => {
  const result = cleanGrammar(sampleInput);
  const grammarResult = result.status === "ok" ? result.result : null;

  it("renders results from valid input as article", () => {
    if (!grammarResult) {
      expect(result.status).toBe("ok");
      return;
    }
    const el = GrammarCleanerView({ result: grammarResult, onReset: () => {} });
    expect(el.type).toBe("article");
  });

  it("renders issues section when issues exist", () => {
    if (!grammarResult) return;
    const el = GrammarCleanerView({ result: grammarResult, onReset: () => {} });
    expect(hasElement(el, (n) => n.props["aria-label"] === "Issues found")).toBe(true);
  });

  it("renders results label", () => {
    if (!grammarResult) return;
    const el = GrammarCleanerView({ result: grammarResult, onReset: () => {} });
    expect(el.props["aria-label"]).toBe("Grammar check results");
  });

  it("renders reset button", () => {
    if (!grammarResult) return;
    const el = GrammarCleanerView({ result: grammarResult, onReset: () => {} });
    expect(hasElement(el, (n) => n.props.type === "button")).toBe(true);
  });
});

describe("GrammarCleaner", () => {
  it("renders empty state for idle", () => {
    const el = GrammarCleaner({
      state: { status: "idle" },
      value: "",
      onChange,
      onSubmit,
    });
    expect(el.type).toBe(GrammarCleanerEmpty);
  });

  it("renders loading state for loading", () => {
    const el = GrammarCleaner({
      state: { status: "loading" },
      value: "",
      onChange,
      onSubmit,
    });
    expect(el.type).toBe(GrammarCleanerLoading);
  });

  it("renders error state for error", () => {
    const el = GrammarCleaner({
      state: { status: "error", code: "empty-body", message: "err" },
      value: "",
      onChange,
      onSubmit,
    });
    expect(el.type).toBe(GrammarCleanerError);
  });

  it("renders ready state for ready", () => {
    const ok = cleanGrammar(sampleInput);
    if (ok.status !== "ok") return;
    const el = GrammarCleaner({
      state: { status: "ready", result: ok.result },
      value: "",
      onChange,
      onSubmit,
    });
    expect(el.type).toBe(GrammarCleanerView);
  });
});
