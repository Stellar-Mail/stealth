/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePostageStatus } from "@/features/ledger/usePostageStatus";
import { sharedTypedApi as api } from "@/lib/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    sharedTypedApi: {
      postage: {
        get: vi.fn(),
      },
    },
  };
});

describe("usePostageStatus", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("returns ready status with data on success", async () => {
    const mockData = { status: "pending", amount: "100" };
    vi.mocked(api.postage.get).mockResolvedValueOnce(mockData as any);

    const { result } = renderHook(() => usePostageStatus("msg-1"), { wrapper });

    expect(result.current.uiState.status).toBe("loading");

    await waitFor(() => {
      expect(result.current.uiState.status).toBe("ready");
    });

    expect((result.current.uiState as any).data).toEqual(mockData);
  });

  it("returns not_found when api throws 404", async () => {
    vi.mocked(api.postage.get).mockRejectedValueOnce({ status: 404 });

    const { result } = renderHook(() => usePostageStatus("msg-2"), { wrapper });

    await waitFor(() => {
      expect(result.current.uiState.status).toBe("not_found");
    });
  });

  it("returns error state on other errors", async () => {
    vi.mocked(api.postage.get).mockRejectedValueOnce(new Error("Network Error"));

    const { result } = renderHook(() => usePostageStatus("msg-3"), { wrapper });

    await waitFor(() => {
      expect(result.current.uiState.status).toBe("error");
    });
  });
});
