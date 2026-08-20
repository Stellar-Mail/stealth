/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendProgress } from "@/features/compose/SendProgress";
import type { StageState } from "@/features/compose/sendPipeline";

const MOCK_STAGES: StageState[] = [
  { id: "resolve", label: "Resolving recipient keys", status: "done", detail: "2 keys resolved" },
  { id: "encrypt", label: "Encrypting message", status: "done", detail: "Sealed" },
  { id: "sign", label: "Awaiting wallet signature", status: "active" },
  { id: "postage", label: "Reserving postage", status: "pending" },
  { id: "persist", label: "Saving to outbox", status: "pending" },
  { id: "submit", label: "Submitting to relay", status: "pending" },
  { id: "reconcile", label: "Confirming delivery", status: "pending" },
];

describe("SendProgress Component (BETA-057)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all stages truthfully with status labels and details", () => {
    render(<SendProgress stages={MOCK_STAGES} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText("Resolving recipient keys")).toBeDefined();
    expect(screen.getByText("2 keys resolved")).toBeDefined();
    expect(screen.getByText("Encrypting message")).toBeDefined();
    expect(screen.getByText("Awaiting wallet signature")).toBeDefined();
    expect(screen.getByText("Reserving postage")).toBeDefined();
    expect(screen.getByText("Submitting to relay")).toBeDefined();
    expect(screen.getByText("Confirming delivery")).toBeDefined();
  });

  it("displays support ID and copies it to clipboard on click", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(
      <SendProgress
        stages={MOCK_STAGES}
        error={null}
        supportId="supp-abc123def456"
        onRetry={vi.fn()}
      />,
    );

    const copyBtn = screen.getByLabelText("Copy support ID supp-abc123def456");
    expect(copyBtn).toBeDefined();
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("supp-abc123def456");
    expect(screen.getByText("Copied")).toBeDefined();
  });

  it("shows error with safe retry button when error is uncommitted", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const errorStages: StageState[] = [
      { id: "resolve", label: "Resolving recipient keys", status: "done" },
      { id: "encrypt", label: "Encrypting message", status: "done" },
      { id: "sign", label: "Awaiting wallet signature", status: "error", detail: "Declined" },
      { id: "postage", label: "Reserving postage", status: "pending" },
    ];

    render(
      <SendProgress
        stages={errorStages}
        error="Signature declined — draft kept"
        canRetry={true}
        isCommitted={false}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Signature declined — draft kept")).toBeDefined();
    expect(screen.getByText("Draft safe")).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: /retry send/i });
    expect(retryBtn).toBeDefined();
    await user.click(retryBtn);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not offer retry when already committed to relay", () => {
    const errorStages: StageState[] = [
      { id: "submit", label: "Submitting to relay", status: "done" },
      { id: "reconcile", label: "Confirming delivery", status: "error" },
    ];

    render(
      <SendProgress
        stages={errorStages}
        error="Relay delivery timeout"
        canRetry={false}
        isCommitted={true}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Committed to relay")).toBeDefined();
    expect(screen.queryByRole("button", { name: /retry send/i })).toBeNull();
  });

  it("toggles failure inspection details when clicked", async () => {
    const user = userEvent.setup();
    const onInspect = vi.fn();
    const errorStages: StageState[] = [
      {
        id: "resolve",
        label: "Resolving recipient keys",
        status: "error",
        detail: "Network error",
      },
    ];

    render(
      <SendProgress
        stages={errorStages}
        error="Failed to resolve keys"
        failureDetails={{
          stage: "resolve",
          code: "ERR_DOMAIN_NOT_FOUND",
          message: "Failed to resolve keys",
          supportId: "supp-err-789",
          timestamp: "2026-08-20T10:00:00Z",
          isCommitted: false,
          canRetry: true,
        }}
        onInspectFailure={onInspect}
      />,
    );

    const inspectBtn = screen.getByRole("button", { name: /inspect failure/i });
    expect(inspectBtn).toBeDefined();

    // Details hidden initially
    expect(screen.queryByText("ERR_DOMAIN_NOT_FOUND")).toBeNull();

    await user.click(inspectBtn);
    expect(onInspect).toHaveBeenCalled();
    expect(screen.getByText("ERR_DOMAIN_NOT_FOUND")).toBeDefined();
    expect(screen.getAllByText("supp-err-789").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2026-08-20T10:00:00Z")).toBeDefined();
  });

  it("triggers onSaveDraft callback when Save Draft is clicked", async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn();

    render(
      <SendProgress
        stages={MOCK_STAGES}
        error="Wallet unavailable"
        canRetry={true}
        isCommitted={false}
        onSaveDraft={onSaveDraft}
      />,
    );

    const saveDraftBtn = screen.getByRole("button", { name: /save draft/i });
    expect(saveDraftBtn).toBeDefined();
    await user.click(saveDraftBtn);

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
  });
});
