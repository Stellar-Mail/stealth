import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingModal } from "../../../src/features/onboarding/OnboardingModal";
import { IdentityStep } from "../../../src/features/onboarding/steps/IdentityStep";
import { UnknownSenderRulesStep } from "../../../src/features/onboarding/steps/UnknownSenderRulesStep";
import {
  DEFAULT_DRAFT,
  ONBOARDING_STEPS,
  SENDER_RULE_TO_POLICY,
  draftToMailboxPolicy,
  xlmToStroops,
  type OnboardingDraft,
} from "../../../src/features/onboarding/types";
import { useOnboarding } from "../../../src/features/onboarding/useOnboarding";
import type { FreighterHook } from "../../../src/features/onboarding/useFreighter";

const TEST_WALLET_ADDRESS = `G${"T".repeat(55)}`;
const STORAGE_KEY = "stealth-onboarding-v1";

type ButtonElement = React.ReactElement<{
  children?: React.ReactNode;
  onClick: () => void | Promise<void>;
}>;

function getText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getText(node.props.children);
  }
  return "";
}

function findElement(
  node: React.ReactNode,
  predicate: (element: React.ReactElement) => boolean,
): React.ReactElement | null {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) return match;
    }
    return null;
  }
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return null;
  if (predicate(node)) return node;
  return findElement(node.props.children, predicate);
}

function findButtonByText(node: React.ReactNode, text: string): ButtonElement {
  const button = findElement(
    node,
    (element) => element.type === "button" && getText(element).includes(text),
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  return button as ButtonElement;
}

function createLocalStorage(seed: Record<string, string> = {}) {
  const store = { ...seed };
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
}

function UseOnboardingSnapshot() {
  const onboarding = useOnboarding({ onComplete: async () => undefined });
  const walletAddress = onboarding.draft.walletAddress ?? "none";
  return React.createElement(
    "output",
    null,
    `${onboarding.step}|${onboarding.stepIndex}|${onboarding.totalSteps}|${walletAddress}|${onboarding.draft.unknownSenderRule}`,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// OnboardingModal / useOnboarding: initial and persisted progress
// ---------------------------------------------------------------------------
describe("OnboardingModal", () => {
  it("renders the first onboarding step and progress when open", () => {
    const markup = renderToStaticMarkup(
      React.createElement(OnboardingModal, {
        open: true,
        onComplete: async () => undefined,
      }),
    );

    expect(markup).toContain("1 / 7");
    expect(markup).toContain("Connect your wallet");
    expect(markup).toContain("Connect with Freighter");
  });

  it("renders nothing when closed", () => {
    const markup = renderToStaticMarkup(
      React.createElement(OnboardingModal, {
        open: false,
        onComplete: async () => undefined,
      }),
    );

    expect(markup).toBe("");
  });
});

describe("useOnboarding persisted progress", () => {
  it("resumes a saved successful setup path", () => {
    const localStorage = createLocalStorage({
      [STORAGE_KEY]: JSON.stringify({
        step: "unknown-sender-rules",
        draft: {
          ...DEFAULT_DRAFT,
          walletAddress: TEST_WALLET_ADDRESS,
          recoveryAcknowledged: true,
          unknownSenderRule: "verified",
        },
      }),
    });
    vi.stubGlobal("window", { localStorage });

    const markup = renderToStaticMarkup(React.createElement(UseOnboardingSnapshot));

    expect(markup).toContain(`unknown-sender-rules|3|7|${TEST_WALLET_ADDRESS}|verified`);
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("falls back to a fresh identity step for unknown saved steps", () => {
    const localStorage = createLocalStorage({
      [STORAGE_KEY]: JSON.stringify({
        step: "legacy-step",
        draft: {
          ...DEFAULT_DRAFT,
          walletAddress: TEST_WALLET_ADDRESS,
          unknownSenderRule: "block",
        },
      }),
    });
    vi.stubGlobal("window", { localStorage });

    const markup = renderToStaticMarkup(React.createElement(UseOnboardingSnapshot));

    expect(markup).toContain("identity|0|7|none|request");
  });
});

// ---------------------------------------------------------------------------
// IdentityStep
// ---------------------------------------------------------------------------
describe("IdentityStep", () => {
  it("advances with the returned wallet address after a successful connection", async () => {
    const onAdvance = vi.fn();
    const freighter: FreighterHook = {
      state: { status: "idle" },
      connect: vi.fn(async () => TEST_WALLET_ADDRESS),
    };

    const step = IdentityStep({ freighter, onAdvance });
    const button = findButtonByText(step, "Connect with Freighter");

    await button.props.onClick();

    expect(freighter.connect).toHaveBeenCalledOnce();
    expect(onAdvance).toHaveBeenCalledWith({ walletAddress: TEST_WALLET_ADDRESS });
  });

  it("shows wallet connection failures without advancing", async () => {
    const onAdvance = vi.fn();
    const freighter: FreighterHook = {
      state: { status: "error", message: "User rejected wallet access" },
      connect: vi.fn(async () => null),
    };

    const step = IdentityStep({ freighter, onAdvance });
    const markup = renderToStaticMarkup(step);
    const button = findButtonByText(step, "Connect with Freighter");

    await button.props.onClick();

    expect(markup).toContain("User rejected wallet access");
    expect(markup).toContain("You can try again below.");
    expect(onAdvance).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// UnknownSenderRulesStep
// ---------------------------------------------------------------------------
describe("UnknownSenderRulesStep", () => {
  const draft: OnboardingDraft = {
    ...DEFAULT_DRAFT,
    walletAddress: TEST_WALLET_ADDRESS,
  };

  it("renders the privacy-preserving sender options", () => {
    const step = UnknownSenderRulesStep({
      draft,
      onUpdate: vi.fn(),
      onAdvance: vi.fn(),
      onRetreat: vi.fn(),
    });
    const markup = renderToStaticMarkup(step);

    expect(markup).toContain("Who can mail you?");
    expect(markup).toContain("Request approval");
    expect(markup).toContain("Verified senders only");
    expect(markup).toContain("Trusted contacts only");
    expect(markup).toContain("Recommended");
  });

  it("updates the draft when a stricter sender rule is selected", () => {
    const onUpdate = vi.fn();
    const step = UnknownSenderRulesStep({
      draft,
      onUpdate,
      onAdvance: vi.fn(),
      onRetreat: vi.fn(),
    });
    const button = findButtonByText(step, "Verified senders only");

    button.props.onClick();

    expect(onUpdate).toHaveBeenCalledWith({ unknownSenderRule: "verified" });
  });
});

// ---------------------------------------------------------------------------
// xlmToStroops
// ---------------------------------------------------------------------------
describe("xlmToStroops", () => {
  it("converts whole XLM amounts", () => {
    expect(xlmToStroops("1")).toBe("10000000");
    expect(xlmToStroops("100")).toBe("1000000000");
  });

  it("converts fractional XLM amounts", () => {
    expect(xlmToStroops("0.0001")).toBe("1000");
    expect(xlmToStroops("0.001")).toBe("10000");
    expect(xlmToStroops("0.01")).toBe("100000");
  });

  it("returns '0' for zero", () => {
    expect(xlmToStroops("0")).toBe("0");
  });

  it("returns '0' for empty string", () => {
    expect(xlmToStroops("")).toBe("0");
  });

  it("returns '0' for negative values", () => {
    expect(xlmToStroops("-1")).toBe("0");
    expect(xlmToStroops("-0.001")).toBe("0");
  });

  it("returns '0' for non-numeric input", () => {
    expect(xlmToStroops("abc")).toBe("0");
    expect(xlmToStroops("NaN")).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// SENDER_RULE_TO_POLICY mapping
// ---------------------------------------------------------------------------
describe("SENDER_RULE_TO_POLICY", () => {
  it("maps request to allowUnknown:true, requireVerified:false", () => {
    expect(SENDER_RULE_TO_POLICY.request).toEqual({
      allowUnknown: true,
      requireVerified: false,
    });
  });

  it("maps verified to allowUnknown:true, requireVerified:true", () => {
    expect(SENDER_RULE_TO_POLICY.verified).toEqual({
      allowUnknown: true,
      requireVerified: true,
    });
  });

  it("maps block to allowUnknown:false, requireVerified:false", () => {
    expect(SENDER_RULE_TO_POLICY.block).toEqual({
      allowUnknown: false,
      requireVerified: false,
    });
  });
});

// ---------------------------------------------------------------------------
// draftToMailboxPolicy
// ---------------------------------------------------------------------------
describe("draftToMailboxPolicy", () => {
  const base: OnboardingDraft = {
    ...DEFAULT_DRAFT,
    walletAddress: `G${"A".repeat(55)}`,
  };

  it("produces a valid policy from the default draft", () => {
    expect(draftToMailboxPolicy(base)).toEqual({
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });
  });

  it("converts postage from XLM to stroops", () => {
    const draft: OnboardingDraft = { ...base, minimumPostage: "0.001" };
    expect(draftToMailboxPolicy(draft).minimumPostage).toBe("10000");
  });

  it("applies the 'verified' sender rule correctly", () => {
    const draft: OnboardingDraft = { ...base, unknownSenderRule: "verified" };
    expect(draftToMailboxPolicy(draft)).toMatchObject({
      allowUnknown: true,
      requireVerified: true,
    });
  });

  it("applies the 'block' sender rule correctly", () => {
    const draft: OnboardingDraft = { ...base, unknownSenderRule: "block" };
    expect(draftToMailboxPolicy(draft)).toMatchObject({
      allowUnknown: false,
      requireVerified: false,
    });
  });
});

// ---------------------------------------------------------------------------
// ONBOARDING_STEPS ordering
// ---------------------------------------------------------------------------
describe("ONBOARDING_STEPS", () => {
  it("starts with identity and ends with policy-review", () => {
    expect(ONBOARDING_STEPS[0]).toBe("identity");
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe("policy-review");
  });

  it("contains exactly 7 steps", () => {
    expect(ONBOARDING_STEPS).toHaveLength(7);
  });

  it("contains all expected steps in order", () => {
    expect(ONBOARDING_STEPS).toEqual([
      "identity",
      "recovery",
      "address",
      "unknown-sender-rules",
      "minimum-postage",
      "receipt-preference",
      "policy-review",
    ]);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_DRAFT: privacy-preserving defaults
// ---------------------------------------------------------------------------
describe("DEFAULT_DRAFT", () => {
  it("uses request as the default sender rule (privacy-preserving)", () => {
    expect(DEFAULT_DRAFT.unknownSenderRule).toBe("request");
  });

  it("starts with no wallet address", () => {
    expect(DEFAULT_DRAFT.walletAddress).toBeNull();
  });

  it("has receipts off by default", () => {
    expect(DEFAULT_DRAFT.receiptOnDelivery).toBe(false);
  });

  it("starts with recovery not acknowledged", () => {
    expect(DEFAULT_DRAFT.recoveryAcknowledged).toBe(false);
  });
});
