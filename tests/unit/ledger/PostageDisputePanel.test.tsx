/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostageDisputePanel } from "@/components/mail/PostageDisputePanel";
import { usePostageStatus } from "@/features/ledger/usePostageStatus";
import { usePostageActions } from "@/features/ledger/usePostageActions";
import { useSession } from "@/features/mail/useSession";
import React from "react";

vi.mock("@/features/ledger/usePostageStatus");
vi.mock("@/features/ledger/usePostageActions");
vi.mock("@/features/mail/useSession");
vi.mock("@/features/settings/useWalletStatus", () => ({
  useWalletStatus: () => ({ ui: { status: "ready", data: { balanceXlm: "10" } } }),
}));
vi.mock("@/features/compose/RecipientPolicyBanner", () => ({
  xlmFromStroops: (v: string) => v,
}));

describe("PostageDisputePanel", () => {
  it("renders null while loading", () => {
    vi.mocked(usePostageStatus).mockReturnValue({
      uiState: { status: "loading" },
    } as any);
    vi.mocked(useSession).mockReturnValue({ data: null } as any);
    vi.mocked(usePostageActions).mockReturnValue({} as any);

    const { container } = render(<PostageDisputePanel messageId="msg-1" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders when data is ready", () => {
    vi.mocked(usePostageStatus).mockReturnValue({
      uiState: {
        status: "ready",
        data: {
          status: "pending",
          amount: "100",
          recipient: "GBREC",
          sender: "GASEN",
          createdAt: new Date().toISOString(),
        },
      },
    } as any);
    vi.mocked(useSession).mockReturnValue({
      data: { user: { address: "GBREC" } },
    } as any);
    vi.mocked(usePostageActions).mockReturnValue({} as any);

    render(<PostageDisputePanel messageId="msg-1" />);
    expect(screen.getByText("Escrow & Dispute")).toBeDefined();
    expect(screen.getByText("pending")).toBeDefined();
  });
});
