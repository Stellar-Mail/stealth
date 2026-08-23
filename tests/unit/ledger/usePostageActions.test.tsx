/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePostageActions } from "@/features/ledger/usePostageActions";
import { sharedTypedApi as api } from "@/lib/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    sharedTypedApi: {
      postage: {
        settle: vi.fn(),
      },
    },
  };
});

describe("usePostageActions", () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("exposes mutation methods", async () => {
    vi.mocked(api.postage.settle).mockResolvedValueOnce({ status: "settled" } as any);
    const { result } = renderHook(() => usePostageActions("msg-1"), { wrapper });

    result.current.settle.mutate({});

    await waitFor(() => {
      expect(result.current.settle.isSuccess).toBe(true);
    });

    expect(api.postage.settle).toHaveBeenCalledWith("msg-1", undefined);
  });
});
