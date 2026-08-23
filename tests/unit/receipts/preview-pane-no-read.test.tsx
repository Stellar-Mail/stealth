// ---------------------------------------------------------------------------
// BETA-064 (Issue #1971) — preview-pane read-receipt acceptance test.
//
// ACCEPTANCE SCENARIO: Preview panes must NOT trigger a read receipt unless
// the user's policy explicitly opts into that behavior. This test proves it.
// ---------------------------------------------------------------------------

/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmailView, type EmailViewActions } from "@/components/mail/EmailView";
import type { Email } from "@/components/mail/data";

function makeEmail(overrides: Partial<Email> = {}): Email {
  return {
    id: "test-msg-1",
    from: "Alice",
    email: "alice@example.com",
    subject: "Test subject",
    preview: "Test preview",
    body: "Test body content",
    time: "Jan 1, 2026",
    unread: true,
    starred: false,
    folder: "inbox",
    avatarColor: "#5b6470",
    ...overrides,
  };
}

describe("EmailView ReceiptStatus (preview pane acceptance)", () => {
  it("does NOT render a read-receipt prompt when receiptState is 'none'", () => {
    const email = makeEmail({ receiptState: "none" });
    render(<EmailView email={email} actions={{}} />);

    expect(screen.queryByText("Read receipt pending")).toBeNull();
    expect(screen.queryByText("Send receipt")).toBeNull();
    expect(screen.queryByText("Read receipt sent")).toBeNull();
  });

  it("renders a manual-prompt when receiptState is 'pending'", () => {
    const email = makeEmail({ receiptState: "pending" });
    const actions: EmailViewActions = {
      onSendReadReceipt: vi.fn(),
    };
    render(<EmailView email={email} actions={actions} />);

    expect(screen.getByText("Read receipt pending")).toBeTruthy();
    expect(screen.getByText("Send receipt")).toBeTruthy();
  });

  it("renders confirmation when receiptState is 'sent'", () => {
    const email = makeEmail({ receiptState: "sent" });
    render(<EmailView email={email} actions={{}} />);

    expect(screen.getByText("Read receipt sent")).toBeTruthy();
  });

  it("does NOT call onSendReadReceipt on render — only on user action", () => {
    const onSend = vi.fn();
    const email = makeEmail({ receiptState: "pending" });
    render(<EmailView email={email} actions={{ onSendReadReceipt: onSend }} />);

    // The component renders but does NOT auto-invoke the callback.
    expect(onSend).not.toHaveBeenCalled();
  });

  it("calls onSendReadReceipt only when the user clicks the button", async () => {
    const onSend = vi.fn();
    const email = makeEmail({ receiptState: "pending" });
    render(<EmailView email={email} actions={{ onSendReadReceipt: onSend }} />);

    const button = screen.getByText("Send receipt");
    button.click();

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(email);
  });
});

describe("EmailView does NOT auto-trigger read receipt on mount", () => {
  it("mounting the component with an unread email does not publish a receipt", () => {
    const onSend = vi.fn();
    const email = makeEmail({ unread: true, receiptState: undefined });
    render(<EmailView email={email} actions={{ onSendReadReceipt: onSend }} />);

    // No receipt action should fire from mere rendering.
    expect(onSend).not.toHaveBeenCalled();
  });
});
