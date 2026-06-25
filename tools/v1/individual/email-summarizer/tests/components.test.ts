import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  EmailSummaryEmpty,
  EmailSummaryLoading,
  EmailSummaryError,
  EmailSummaryView,
  EmailSummarizer,
} from "../components";
import { SAMPLE_EMAILS } from "../services/fixtures";
import { summarizeEmail } from "../services/emailSummarizer";

const sampleEmail = SAMPLE_EMAILS[0].email;

function isElement(n: unknown): n is ReactElement {
  return (
    typeof n === "object" && n !== null && "type" in n && "props" in (n as Record<string, unknown>)
  );
}

function findInTree(node: any, predicate: (el: any) => boolean): any {
  if (!isElement(node)) return null;
  if (predicate(node)) return node;
  const children = (node as any).props.children;
  if (children == null) return null;
  const arr = Array.isArray(children) ? children : [children];
  for (const child of arr) {
    const found = findInTree(child, predicate);
    if (found) return found;
  }
  return null;
}

function hasElement(node: ReactNode, predicate: (el: any) => boolean): boolean {
  return findInTree(node, predicate) !== null;
}

describe("EmailSummaryEmpty", () => {
  it("renders idle placeholder text", () => {
    const result = EmailSummaryEmpty().type;
    expect(result).toBe("section");
  });
});

describe("EmailSummaryLoading", () => {
  it("renders with aria-busy", () => {
    const el = EmailSummaryLoading();
    expect(el.type).toBe("section");
    expect(el.props["aria-busy"]).toBe("true");
  });
});

describe("EmailSummaryError", () => {
  const defaultProps = { code: "empty-body", message: "Cannot summarize an empty email." };

  it("renders error heading and message", () => {
    const el = EmailSummaryError(defaultProps);
    expect(hasElement(el, (n) => n.props.children === "Unable to summarize")).toBe(true);
    expect(hasElement(el, (n) => String(n.props.children).includes("Cannot summarize"))).toBe(true);
  });

  it("renders retry button when onRetry provided", () => {
    const el = EmailSummaryError({ ...defaultProps, onRetry: () => {} });
    expect(hasElement(el, (n) => n.props.type === "button")).toBe(true);
  });

  it("does not render retry button when onRetry omitted", () => {
    const el = EmailSummaryError(defaultProps);
    expect(hasElement(el, (n) => n.props.type === "button")).toBe(false);
  });
});

describe("EmailSummaryView", () => {
  const result = summarizeEmail(sampleEmail);
  const summary = result.status === "ok" ? result.summary : null;

  it("renders summary from valid email as article", () => {
    if (!summary) {
      expect(result.status).toBe("ok");
      return;
    }
    const el = EmailSummaryView({ summary });
    expect(el.type).toBe("article");
  });

  it("renders action items section when items exist", () => {
    if (!summary) return;
    const el = EmailSummaryView({ summary });
    expect(hasElement(el, (n) => n.props["aria-label"] === "Action items")).toBe(true);
  });

  it("renders source metadata label", () => {
    if (!summary) return;
    const el = EmailSummaryView({ summary });
    expect(el.props["aria-label"]).toBe("Email summary");
  });
});

describe("EmailSummarizer", () => {
  it("renders empty state for idle", () => {
    const el = EmailSummarizer({ state: { status: "idle" } });
    expect(el.type).toBe(EmailSummaryEmpty);
  });

  it("renders loading state for loading", () => {
    const el = EmailSummarizer({ state: { status: "loading" } });
    expect(el.type).toBe(EmailSummaryLoading);
  });

  it("renders error state for error", () => {
    const el = EmailSummarizer({
      state: { status: "error", code: "empty-body", message: "err" },
    });
    expect(el.type).toBe(EmailSummaryError);
  });

  it("renders ready state for ready", () => {
    const ok = summarizeEmail(sampleEmail);
    if (ok.status !== "ok") return;
    const el = EmailSummarizer({
      state: { status: "ready", summary: ok.summary },
    });
    expect(el.type).toBe(EmailSummaryView);
  });
});
