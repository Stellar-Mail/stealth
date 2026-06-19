import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConvertSenderButton } from "../../../src/features/sender-conversion/ConvertSenderButton";
import {
  SENDER_POLICY_OPTIONS,
  getSenderPolicyOption,
  resolveSenderConversion,
  type SenderPolicyChoice,
} from "../../../src/features/sender-conversion/types";

// ---------------------------------------------------------------------------
// Option metadata
// ---------------------------------------------------------------------------
describe("SENDER_POLICY_OPTIONS", () => {
  it("explains allow, verify, and block as distinct choices", () => {
    expect(SENDER_POLICY_OPTIONS.map((option) => option.value)).toEqual([
      "allow",
      "verify",
      "block",
    ]);
  });

  it("gives every option an effect description so differences are explained", () => {
    for (const option of SENDER_POLICY_OPTIONS) {
      expect(option.summary.length).toBeGreaterThan(0);
      expect(option.effect.length).toBeGreaterThan(0);
    }
  });

  it("resolves an option for each choice", () => {
    for (const choice of ["allow", "verify", "block"] as SenderPolicyChoice[]) {
      expect(getSenderPolicyOption(choice).value).toBe(choice);
    }
  });
});

// ---------------------------------------------------------------------------
// ConvertSenderButton
// ---------------------------------------------------------------------------
describe("ConvertSenderButton", () => {
  it("renders the shared conversion CTA as a non-submit button", () => {
    const html = renderToStaticMarkup(
      createElement(ConvertSenderButton, { onClick: () => undefined }),
    );

    expect(html).toContain('type="button"');
    expect(html).toContain("Convert to contact");
  });

  it("supports contextual labels and variants for request-card entry points", () => {
    const html = renderToStaticMarkup(
      createElement(ConvertSenderButton, {
        onClick: () => undefined,
        label: "Review sender",
        variant: "ghost",
        className: "request-card-action",
      }),
    );

    expect(html).toContain("Review sender");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("request-card-action");
  });
});

// ---------------------------------------------------------------------------
// resolveSenderConversion
// ---------------------------------------------------------------------------
describe("resolveSenderConversion", () => {
  it("files an allowed sender in the inbox with a trusted badge", () => {
    const result = resolveSenderConversion({ from: "Lina" }, "allow");
    expect(result.folder).toBe("inbox");
    expect(result.patch.folder).toBe("inbox");
    expect(result.patch.senderPolicy).toBe("allow");
    expect(result.patch.labels).toContain("Trusted");
    expect(result.toast.tone).toBe("success");
  });

  it("files a verified sender under Verified", () => {
    const result = resolveSenderConversion({ from: "Mina" }, "verify");
    expect(result.folder).toBe("verified");
    expect(result.patch.labels).toContain("Verified");
  });

  it("quarantines a blocked sender to spam with a danger tone", () => {
    const result = resolveSenderConversion({ from: "Spammer" }, "block");
    expect(result.folder).toBe("spam");
    expect(result.patch.senderPolicy).toBe("block");
    expect(result.toast.tone).toBe("danger");
    expect(result.toast.message).toMatch(/refund/i);
  });

  it("keeps unrelated labels but never stacks stale conversion badges on re-decision", () => {
    const result = resolveSenderConversion(
      { from: "Lina", labels: ["Design", "Trusted"] },
      "block",
    );
    expect(result.patch.labels).toContain("Design");
    expect(result.patch.labels).toContain("Blocked");
    expect(result.patch.labels).not.toContain("Trusted");
  });
});
