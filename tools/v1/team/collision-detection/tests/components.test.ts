import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";

import {
  CollisionDetectionEmpty,
  CollisionDetectionLoading,
  CollisionDetectionError,
  CollisionDetectedView,
  CollisionDetectionView,
} from "../components";
import { COLLISION_FIXTURES } from "../services/fixtures";
import { scanActiveReplies } from "../services/collisionDetection";

const sampleReplies = COLLISION_FIXTURES[0].replies;

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

describe("CollisionDetectionEmpty", () => {
  it("renders idle placeholder as section", () => {
    const result = CollisionDetectionEmpty();
    expect(result.type).toBe("section");
  });
});

describe("CollisionDetectionLoading", () => {
  it("renders with aria-busy", () => {
    const el = CollisionDetectionLoading();
    expect(el.type).toBe("section");
    expect(el.props["aria-busy"]).toBe("true");
  });
});

describe("CollisionDetectionError", () => {
  const defaultProps = {
    code: "scan-failed",
    message: "Invalid reply data: expected an array of active replies.",
  };

  it("renders error heading and message", () => {
    const el = CollisionDetectionError(defaultProps);
    expect(hasElement(el, (n) => String(n.props.children).includes("Unable to complete"))).toBe(
      true,
    );
    expect(hasElement(el, (n) => String(n.props.children).includes("Invalid reply data"))).toBe(
      true,
    );
  });

  it("renders retry button when onRetry provided", () => {
    const el = CollisionDetectionError({ ...defaultProps, onRetry: () => {} });
    expect(hasElement(el, (n) => n.props.type === "button")).toBe(true);
  });

  it("does not render retry button when onRetry omitted", () => {
    const el = CollisionDetectionError(defaultProps);
    expect(hasElement(el, (n) => n.props.type === "button")).toBe(false);
  });
});

describe("CollisionDetectedView", () => {
  const result = scanActiveReplies(sampleReplies, 10);
  const data = result.status === "ok" ? result.data : null;

  it("renders as article when collisions exist", () => {
    if (!data) {
      expect(result.status).toBe("ok");
      return;
    }
    const el = CollisionDetectedView({
      events: data.events,
      monitoredThreads: data.monitoredThreads,
    });
    expect(el.type).toBe("article");
  });

  it("renders collision event list", () => {
    if (!data) return;
    const el = CollisionDetectedView({
      events: data.events,
      monitoredThreads: data.monitoredThreads,
    });
    expect(hasElement(el, (n) => n.props["aria-label"] === "Collision events")).toBe(true);
  });

  it("renders all-clear message when no collisions", () => {
    const el = CollisionDetectedView({ events: [], monitoredThreads: 5 });
    expect(hasElement(el, (n) => String(n.props.children).includes("All clear"))).toBe(true);
  });
});

describe("CollisionDetectionView", () => {
  it("renders empty state for idle", () => {
    const el = CollisionDetectionView({ state: { status: "idle" } });
    expect(el.type).toBe(CollisionDetectionEmpty);
  });

  it("renders loading state for loading", () => {
    const el = CollisionDetectionView({ state: { status: "loading" } });
    expect(el.type).toBe(CollisionDetectionLoading);
  });

  it("renders error state for error", () => {
    const el = CollisionDetectionView({
      state: { status: "error", code: "scan-failed", message: "err" },
    });
    expect(el.type).toBe(CollisionDetectionError);
  });

  it("renders ready state for ready", () => {
    const ok = scanActiveReplies(sampleReplies, 10);
    if (ok.status !== "ok") return;
    const el = CollisionDetectionView({
      state: {
        status: "ready",
        events: ok.data.events,
        monitoredThreads: ok.data.monitoredThreads,
      },
    });
    expect(el.type).toBe(CollisionDetectedView);
  });
});
