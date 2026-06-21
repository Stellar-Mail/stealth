import React from "react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DigestEmptyState } from "../components/states/DigestEmptyState";
import { DigestErrorState } from "../components/states/DigestErrorState";
import { DigestLoadingState } from "../components/states/DigestLoadingState";
import { DigestSuccessState } from "../components/states/DigestSuccessState";
import { InboxDailyDigestTool } from "../components/InboxDailyDigestTool";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: <T>(val: T) => {
      const originalError = console.error;
      console.error = () => {};
      try {
        try {
          return actual.useState(val);
        } finally {
          console.error = originalError;
        }
      } catch {
        return [typeof val === "function" ? (val as () => T)() : val, () => {}];
      }
    },
    useMemo: <T>(fn: () => T) => {
      const originalError = console.error;
      console.error = () => {};
      try {
        try {
          return actual.useMemo(fn);
        } finally {
          console.error = originalError;
        }
      } catch {
        return fn();
      }
    },
  };
});

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

describe("DigestEmptyState", () => {
  it("renders panel and header", () => {
    const el = DigestEmptyState();
    expect(el.type).toBe("div");
    expect(hasElement(el, (n) => n.props.children === "No digest generated yet")).toBe(true);
  });
});

describe("DigestLoadingState", () => {
  it("renders with aria-busy for accessibility", () => {
    const el = DigestLoadingState();
    expect(el.type).toBe("div");
    expect(el.props["aria-busy"]).toBe("true");
    expect(hasElement(el, (n) => n.props.children === "Building digest preview")).toBe(true);
  });
});

describe("DigestErrorState", () => {
  const defaultProps = { message: "Test error message", onRetry: () => {} };

  it("renders error message and retry button", () => {
    const el = DigestErrorState(defaultProps);
    expect(el.props.role).toBe("alert");
    expect(hasElement(el, (n) => n.props.children === "Test error message")).toBe(true);
    expect(
      hasElement(el, (n) => n.props.type === "button" && n.props.children === "Retry preview"),
    ).toBe(true);
  });
});

describe("DigestSuccessState", () => {
  const digest = {
    dateLabel: "Today",
    summary: "Mock summary text",
    insights: [{ id: "priority", label: "High priority", value: "1" }],
    topEmails: [
      {
        id: "msg-1",
        sender: "alice@example.com",
        subject: "Meeting details",
        receivedAt: "10:00",
        priority: "high" as const,
      },
    ],
    nextActions: ["action item"],
  };

  it("renders success container as article", () => {
    const el = DigestSuccessState({ digest, tone: "Focused", onReset: () => {} });
    expect(el.type).toBe("article");
    expect(el.props["aria-labelledby"]).toBe("idd-result-title");
  });

  it("renders summary narrative text", () => {
    const el = DigestSuccessState({ digest, tone: "Focused", onReset: () => {} });
    expect(hasElement(el, (n) => n.props.children === digest.summary)).toBe(true);
  });

  it("renders warnings box when warnings are present", () => {
    const warnings = ["Truncated 1 email body"];
    const el = DigestSuccessState({ digest, tone: "Focused", onReset: () => {}, warnings });
    expect(hasElement(el, (n) => n.props.className === "idd-warnings-box")).toBe(true);
  });
});

describe("InboxDailyDigestTool", () => {
  it("renders container section and form on initialization", () => {
    const el = InboxDailyDigestTool({});
    expect(el.type).toBe("section");
    expect(el.props["aria-labelledby"]).toBe("idd-title");
  });
});
