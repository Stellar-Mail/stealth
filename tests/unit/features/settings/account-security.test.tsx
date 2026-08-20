/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSecuritySection } from "@/features/settings/account-security";
import { sharedTypedApi as api } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    sharedTypedApi: {
      ...actual.sharedTypedApi,
      auth: {
        listSessions: vi.fn(),
        revokeSession: vi.fn(),
        revokeOtherSessions: vi.fn(),
      },
    },
  };
});

vi.mock("@/features/settings/recovery-codes", () => ({
  RecoveryCodesSection: () => (
    <div data-testid="mock-recovery-codes-section">Recovery Codes Mock</div>
  ),
}));

vi.mock("@/features/settings/ManagedWalletStatus", () => ({
  ManagedWalletStatus: () => (
    <div data-testid="mock-managed-wallet-status">Managed Wallet Mock</div>
  ),
}));

vi.mock("@/features/settings/external-wallet-linking", () => ({
  ExternalWalletSettings: () => (
    <div data-testid="mock-external-wallet-settings">External Wallet Mock</div>
  ),
}));

describe("AccountSecuritySection component", () => {
  let queryClient: QueryClient;

  const mockSessions = [
    {
      sessionId: "sess_curr_1",
      createdAt: "2026-08-20T00:00:00Z",
      lastActiveAt: "2026-08-20T01:00:00Z",
      expiresAt: "2026-08-27T00:00:00Z",
      isCurrent: true,
      deviceSummary: "Chrome on macOS",
      approximateRegion: "US",
    },
    {
      sessionId: "sess_other_2",
      createdAt: "2026-08-19T10:00:00Z",
      lastActiveAt: "2026-08-19T12:00:00Z",
      expiresAt: "2026-08-26T10:00:00Z",
      isCurrent: false,
      deviceSummary: "Safari on iOS",
      approximateRegion: "United Kingdom",
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("renders active sessions, current session badge, and nested recovery/wallet sections", async () => {
    vi.mocked(api.auth.listSessions).mockResolvedValue({ sessions: mockSessions });

    render(
      <QueryClientProvider client={queryClient}>
        <AccountSecuritySection />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/active sessions & devices/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Chrome on macOS")).toBeDefined();
      expect(screen.getByText("Safari on iOS")).toBeDefined();
    });

    expect(screen.getByTestId("current-session-badge")).toBeDefined();
    expect(screen.getByText("Current session")).toBeDefined();
    expect(screen.getByTestId("mock-recovery-codes-section")).toBeDefined();
    expect(screen.getByTestId("mock-managed-wallet-status")).toBeDefined();
    expect(screen.getByTestId("mock-external-wallet-settings")).toBeDefined();
  });

  it("triggers confirmation dialog when revoking other sessions", async () => {
    vi.mocked(api.auth.listSessions).mockResolvedValue({ sessions: mockSessions });
    vi.mocked(api.auth.revokeOtherSessions).mockResolvedValue({ success: true, revokedCount: 1 });

    render(
      <QueryClientProvider client={queryClient}>
        <AccountSecuritySection />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Safari on iOS")).toBeDefined();
    });

    const revokeOthersBtn = screen.getByLabelText(/revoke all other sessions/i);
    expect(revokeOthersBtn).toBeDefined();
    fireEvent.click(revokeOthersBtn);

    // Dialog appears
    expect(screen.getByText(/revoke all other sessions\?/i)).toBeDefined();

    const confirmBtn = screen.getByRole("button", { name: /revoke all others/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.auth.revokeOtherSessions).toHaveBeenCalled();
    });
  });

  it("triggers confirmation dialog and calls revokeSession for single session", async () => {
    vi.mocked(api.auth.listSessions).mockResolvedValue({ sessions: mockSessions });
    vi.mocked(api.auth.revokeSession).mockResolvedValue({
      success: true,
      revokedSessionId: "sess_other_2",
      selfRevoked: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AccountSecuritySection />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Safari on iOS")).toBeDefined();
    });

    const revokeBtn = screen.getByLabelText(/revoke session on safari on ios/i);
    fireEvent.click(revokeBtn);

    expect(screen.getByText(/revoke session\?/i)).toBeDefined();

    const confirmBtn = screen.getByRole("button", { name: /revoke session/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.auth.revokeSession).toHaveBeenCalledWith("sess_other_2");
    });
  });
});
