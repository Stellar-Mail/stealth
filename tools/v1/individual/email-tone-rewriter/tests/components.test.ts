import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  EmailToneRewriter,
  EmailToneRewriterEmpty,
  EmailToneRewriterError,
  EmailToneRewriterLoading,
  EmailToneRewriterSuccess,
} from "../components";
import { FORMAL_FOLLOW_UP } from "../services/fixtures";
import { rewriteEmailTone, toReadyState } from "../services/emailToneRewriter";

type TypedElement = Omit<ReactElement, "props"> & { props: Record<string, unknown> };

function isElement(node: unknown): node is TypedElement {
  return typeof node === "object" && node !== null && "props" in node;
}

function findInTree(
  node: ReactNode,
  predicate: (element: TypedElement) => boolean,
): TypedElement | null {
  if (!isElement(node)) return null;
  if (predicate(node)) return node;
  const children = node.props.children;
  if (children == null) return null;
  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    const found = findInTree(child, predicate);
    if (found) return found;
  }
  return null;
}

function hasElement(node: ReactNode, predicate: (element: TypedElement) => boolean): boolean {
  return findInTree(node, predicate) !== null;
}

const emptyProps = {
  subject: "Following up",
  bodyText: FORMAL_FOLLOW_UP.bodyText,
  tone: "formal" as const,
  onSubjectChange: () => {},
  onBodyChange: () => {},
  onToneChange: () => {},
  onSubmit: () => {},
};

describe("EmailToneRewriterEmpty", () => {
  it("renders the input surface as a labelled region", () => {
    const el = EmailToneRewriterEmpty(emptyProps);
    expect(el.type).toBe("section");
    expect(el.props.role).toBe("region");
    expect(el.props["aria-labelledby"]).toBe("etr-title");
  });

  it("renders labelled subject and body controls", () => {
    const el = EmailToneRewriterEmpty(emptyProps);
    expect(hasElement(el, (node) => node.props.htmlFor === "etr-subject")).toBe(true);
    expect(hasElement(el, (node) => node.props.id === "etr-body")).toBe(true);
  });

  it("renders an accessible tone radio group", () => {
    const el = EmailToneRewriterEmpty(emptyProps);
    expect(hasElement(el, (node) => node.type === "fieldset")).toBe(true);
    expect(
      hasElement(el, (node) => node.props.type === "radio" && node.props.value === "formal"),
    ).toBe(true);
  });

  it("disables submit when the body is empty", () => {
    const el = EmailToneRewriterEmpty({ ...emptyProps, bodyText: "   " });
    expect(
      hasElement(el, (node) => node.props.type === "button" && node.props.disabled === true),
    ).toBe(true);
  });
});

describe("EmailToneRewriterLoading", () => {
  it("announces loading state", () => {
    const el = EmailToneRewriterLoading();
    expect(el.props["aria-busy"]).toBe("true");
    expect(el.props.role).toBe("status");
  });
});

describe("EmailToneRewriterError", () => {
  it("uses alert semantics and optional retry", () => {
    const el = EmailToneRewriterError({
      code: "empty-body",
      message: "Cannot rewrite.",
      onRetry: () => {},
    });
    expect(el.props.role).toBe("alert");
    expect(hasElement(el, (node) => node.props.type === "button")).toBe(true);
  });
});

describe("EmailToneRewriterSuccess", () => {
  const result = rewriteEmailTone(FORMAL_FOLLOW_UP);
  const rewrite = result.status === "ok" ? result.rewrite : null;

  it("renders rewritten output as a focusable review panel", () => {
    if (!rewrite) throw new Error("fixture should rewrite");
    const el = EmailToneRewriterSuccess({ rewrite });
    expect(el.type).toBe("article");
    expect(
      hasElement(
        el,
        (node) => node.props["aria-label"] === "Rewritten email body" && node.props.tabIndex === 0,
      ),
    ).toBe(true);
  });

  it("documents disabled action scope in the success state", () => {
    if (!rewrite) throw new Error("fixture should rewrite");
    const el = EmailToneRewriterSuccess({ rewrite });
    expect(hasElement(el, (node) => String(node.props.children).includes("Send disabled"))).toBe(
      true,
    );
  });
});

describe("EmailToneRewriter", () => {
  it("routes idle state to the empty component", () => {
    const el = EmailToneRewriter({ ...emptyProps, state: { status: "idle" } });
    expect(el.type).toBe(EmailToneRewriterEmpty);
  });

  it("routes ready state to the success component", () => {
    const state = toReadyState(rewriteEmailTone(FORMAL_FOLLOW_UP));
    const el = EmailToneRewriter({ ...emptyProps, state });
    expect(el.type).toBe(EmailToneRewriterSuccess);
  });
});
