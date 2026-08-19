import { describe, expect, it } from "vitest";

import type { PublicWalletStatus } from "../../../src/lib/api";
import { resolveWalletStatusUiState } from "../../../src/features/settings/useWalletStatus";

const base: PublicWalletStatus = {
  address: `G${"W".repeat(55)}`,
  network: "testnet",
  networkPassphrase: "Test SDF Network ; September 2015",
  balanceXlm: "1.0000000",
  activation: "active",
  lastSyncedAt: "2026-08-18T12:00:00.000Z",
  stale: false,
  freshness: "fresh",
};

describe("resolveWalletStatusUiState (BETA-019)", () => {
  it("is loading until the first payload arrives", () => {
    expect(resolveWalletStatusUiState({ isLoading: true, isError: false }).kind).toBe("loading");
  });

  it("is unavailable when the request fails with no payload", () => {
    expect(resolveWalletStatusUiState({ isLoading: false, isError: true }).kind).toBe(
      "unavailable",
    );
  });

  it("is pending while activation has not completed", () => {
    const ui = resolveWalletStatusUiState({
      isLoading: false,
      isError: false,
      status: { ...base, activation: "pending", balanceXlm: null },
    });
    expect(ui.kind).toBe("pending");
  });

  it("is stale when the cache freshness marker is set", () => {
    const ui = resolveWalletStatusUiState({
      isLoading: false,
      isError: false,
      status: { ...base, freshness: "stale", stale: true },
    });
    expect(ui.kind).toBe("stale");
  });

  it("is unavailable when Horizon/RPC freshness is unavailable", () => {
    const ui = resolveWalletStatusUiState({
      isLoading: false,
      isError: false,
      status: { ...base, freshness: "unavailable", stale: true, balanceXlm: null },
    });
    expect(ui.kind).toBe("unavailable");
  });

  it("is active for a funded fresh wallet", () => {
    const ui = resolveWalletStatusUiState({
      isLoading: false,
      isError: false,
      status: base,
    });
    expect(ui.kind).toBe("active");
  });

  it("is failed when activation failed and data is otherwise fresh", () => {
    const ui = resolveWalletStatusUiState({
      isLoading: false,
      isError: false,
      status: { ...base, activation: "failed" },
    });
    expect(ui.kind).toBe("failed");
  });
});
