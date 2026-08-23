/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { useOnboarding } from "@/features/onboarding/useOnboarding";
import type { OnboardingCompleteResult } from "@/features/onboarding/api";
import {
  fetchOnboardingDraft,
  saveOnboardingDraft,
  completeOnboarding,
} from "@/features/onboarding/api";

vi.mock("@/features/onboarding/api", () => ({
  fetchOnboardingDraft: vi.fn(),
  saveOnboardingDraft: vi.fn(),
  completeOnboarding: vi.fn(),
}));

const COMPLETED_RESULT: OnboardingCompleteResult = {
  alreadyCompleted: false,
  draft: {
    status: "completed",
    step: "review",
    displayName: "Ada",
    recoveryAcknowledged: true,
    unknownSenderRule: "request",
    minimumPostage: "0",
    receiptOnDelivery: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:00.000Z",
  },
  policy: {
    allowUnknown: true,
    requireVerified: false,
    minimumPostage: "0",
    requireReceipt: false,
  },
};

describe("useOnboarding (profile-first, wallet-free)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOnboardingDraft).mockResolvedValue(null);
    vi.mocked(saveOnboardingDraft).mockResolvedValue({
      status: "in_progress",
      step: "profile",
      displayName: "",
      recoveryAcknowledged: false,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    });
    vi.mocked(completeOnboarding).mockResolvedValue(COMPLETED_RESULT);
  });

  it("completes the flow without any wallet address in the payload", async () => {
    const { result } = renderHook(() => useOnboarding({}));

    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    act(() => result.current.update({ displayName: "Ada", recoveryAcknowledged: true }));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.completed).not.toBeNull();

    const payloads = vi.mocked(saveOnboardingDraft).mock.calls.map(([, draft]) => draft);
    for (const payload of payloads) {
      expect(payload).not.toHaveProperty("walletAddress");
    }
    const submitPayload = vi.mocked(completeOnboarding).mock.calls[0][0];
    expect(submitPayload).not.toHaveProperty("walletAddress");
    expect(submitPayload).toMatchObject({ displayName: "Ada", recoveryAcknowledged: true });
  });

  it("resumes from the server record on refresh (no localStorage)", async () => {
    vi.mocked(fetchOnboardingDraft).mockResolvedValue({
      status: "in_progress",
      step: "recovery",
      displayName: "Grace",
      recoveryAcknowledged: true,
      unknownSenderRule: "verified",
      minimumPostage: "0.001",
      receiptOnDelivery: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    });

    const { result } = renderHook(() => useOnboarding({}));

    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    expect(result.current.step).toBe("recovery");
    expect(result.current.draft).toMatchObject({
      displayName: "Grace",
      recoveryAcknowledged: true,
      unknownSenderRule: "verified",
      minimumPostage: "0.001",
      receiptOnDelivery: true,
    });
    expect(typeof window !== "undefined" ? (window.localStorage?.length ?? 0) : 0).toBe(0);
  });

  it("resumes on a second device from the shared server record", async () => {
    vi.mocked(fetchOnboardingDraft).mockResolvedValue({
      status: "in_progress",
      step: "postage",
      displayName: "Katherine",
      recoveryAcknowledged: true,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-02T00:00:00.000Z",
      completedAt: null,
    });

    const { result } = renderHook(() => useOnboarding({}));

    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    expect(result.current.step).toBe("postage");
    expect(result.current.draft.displayName).toBe("Katherine");

    const draft = await fetchOnboardingDraft();
    expect(draft?.step).toBe("postage");
  });

  it("restores a completed flow into the completed state", async () => {
    vi.mocked(fetchOnboardingDraft).mockResolvedValue({
      status: "completed",
      step: "review",
      displayName: "Ada",
      recoveryAcknowledged: true,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:00.000Z",
    });

    const { result } = renderHook(() => useOnboarding({}));

    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    expect(result.current.completed).toMatchObject({ alreadyCompleted: true });
  });

  it("keeps the idempotency key stable across duplicate submissions and re-sends the same key", async () => {
    vi.mocked(fetchOnboardingDraft).mockResolvedValue({
      status: "in_progress",
      step: "review",
      displayName: "Ada",
      recoveryAcknowledged: true,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    });

    const { result } = renderHook(() => useOnboarding({}));
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    const results = await act(async () => {
      const first = await result.current.submit();
      const second = await result.current.submit();
      return [first, second];
    });

    expect(results[0]).not.toBeNull();
    expect(results[1]).not.toBeNull();
    const calls = vi.mocked(completeOnboarding).mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][1]).toBeDefined();
    expect(calls[1][1]).toBe(calls[0][1]);
  });

  it("does not call the complete endpoint a second time once completed", async () => {
    vi.mocked(fetchOnboardingDraft).mockResolvedValue({
      status: "in_progress",
      step: "review",
      displayName: "Ada",
      recoveryAcknowledged: true,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    });

    const { result } = renderHook(() => useOnboarding({}));
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    await act(async () => {
      await result.current.submit();
    });
    expect(vi.mocked(completeOnboarding).mock.calls.length).toBe(1);

    await act(async () => {
      await result.current.submit();
    });
    expect(vi.mocked(completeOnboarding).mock.calls.length).toBe(1);
  });

  it("refuses submission until the display name and recovery acknowledgment are set", async () => {
    const { result } = renderHook(() => useOnboarding({}));
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    await act(async () => {
      await expect(result.current.submit()).rejects.toThrow(/display name/i);
    });
    expect(completeOnboarding).not.toHaveBeenCalled();

    act(() => result.current.update({ displayName: "Ada" }));
    await act(async () => {
      await expect(result.current.submit()).rejects.toThrow(/recovery acknowledgment/i);
    });
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it("persists progress to the server as the user advances", async () => {
    const { result } = renderHook(() => useOnboarding({}));
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    act(() => result.current.advance());
    await waitFor(() => expect(saveOnboardingDraft).toHaveBeenCalled());

    const [step, draft] = vi.mocked(saveOnboardingDraft).mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(step).toBe("stealth-address");
    expect(draft).not.toHaveProperty("walletAddress");
  });
});
