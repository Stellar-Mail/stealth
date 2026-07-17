// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePaymentRequests, usePaymentApproval } from "../hooks";
import { mockPayments } from "../fixtures/payments.fixtures";

describe("usePaymentRequests hook", () => {
  it("should initialize with initialPayments", () => {
    const { result } = renderHook(() => usePaymentRequests({ initialPayments: mockPayments }));

    expect(result.current.payments).toEqual(mockPayments);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should filter by status", () => {
    const { result } = renderHook(() => usePaymentRequests({ initialPayments: mockPayments }));

    const pending = result.current.filterByStatus("pending");
    expect(pending).toHaveLength(mockPayments.filter((p) => p.status === "pending").length);
  });

  it("should filter by priority", () => {
    const { result } = renderHook(() => usePaymentRequests({ initialPayments: mockPayments }));

    const urgent = result.current.filterByPriority("urgent");
    expect(urgent).toHaveLength(1);
    expect(urgent[0].id).toBe("payment-3");
  });

  it("should fetch payments on calling fetch", async () => {
    const mockOnFetch = vi.fn().mockResolvedValue(mockPayments);
    const { result } = renderHook(() => usePaymentRequests({ onFetch: mockOnFetch }));

    // Initial load will trigger fetch because initialPayments is not provided but onFetch is
    expect(result.current.isLoading).toBe(true);

    // Wait for the effect / state update to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockOnFetch).toHaveBeenCalled();
    expect(result.current.payments).toEqual(mockPayments);
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle fetch error", async () => {
    const mockOnFetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    const { result } = renderHook(() => usePaymentRequests({ onFetch: mockOnFetch }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.error).toBe("Failed to fetch");
    expect(result.current.isLoading).toBe(false);
  });
});

describe("usePaymentApproval hook", () => {
  it("should initialize with default states", () => {
    const { result } = renderHook(() => usePaymentApproval());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.decisions.size).toBe(0);
  });

  it("should record approval decision and trigger onApprove callback", async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePaymentApproval({ onApprove }));

    await act(async () => {
      await result.current.approve("payment-1", "Approve notes");
    });

    expect(onApprove).toHaveBeenCalledWith("payment-1", "Approve notes");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);

    const decision = result.current.getDecision("payment-1");
    expect(decision).toBeDefined();
    expect(decision?.decision).toBe("approve");
    expect(decision?.notes).toBe("Approve notes");
  });

  it("should record rejection decision and trigger onReject callback", async () => {
    const onReject = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePaymentApproval({ onReject }));

    await act(async () => {
      await result.current.reject("payment-2", "Reject notes");
    });

    expect(onReject).toHaveBeenCalledWith("payment-2", "Reject notes");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);

    const decision = result.current.getDecision("payment-2");
    expect(decision).toBeDefined();
    expect(decision?.decision).toBe("reject");
    expect(decision?.notes).toBe("Reject notes");
  });

  it("should handle error in approval callback", async () => {
    const onApprove = vi.fn().mockRejectedValue(new Error("Approval Error"));
    const { result } = renderHook(() => usePaymentApproval({ onApprove }));

    await act(async () => {
      try {
        await result.current.approve("payment-1", "notes");
      } catch (err) {
        // Expected error - catch inside act to allow React to flush state updates
      }
    });

    expect(result.current.error).toBe("Approval Error");
    expect(result.current.isLoading).toBe(false);
  });

  it("should clear error", async () => {
    const onApprove = vi.fn().mockRejectedValue(new Error("Error"));
    const { result } = renderHook(() => usePaymentApproval({ onApprove }));

    await act(async () => {
      try {
        await result.current.approve("payment-1");
      } catch (err) {
        // Expected error
      }
    });

    expect(result.current.error).toBe("Error");

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
