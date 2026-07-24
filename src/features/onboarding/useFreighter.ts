import { useState } from "react";

export type FreighterStatus = "idle" | "connecting" | "connected" | "unavailable" | "error";

export type FreighterState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; address: string }
  | { status: "unavailable" }
  | { status: "error"; message: string };

/**
 * Thin adapter over @stellar/freighter-api v6.
 *
 * Separates wallet I/O from step UI so each can be tested independently.
 * The import is dynamic to avoid loading Freighter in non-browser environments
 * (Cloudflare Workers SSR pass).
 */
export function useFreighter() {
  const [state, setState] = useState<FreighterState>({ status: "idle" });

  async function connect(): Promise<string | null> {
    setState({ status: "connecting" });

    try {
      const freighterModule = await import("@stellar/freighter-api");
      const freighter = freighterModule.default || freighterModule;

      const { isConnected } = await freighter.isConnected();
      if (!isConnected) {
        setState({ status: "unavailable" });
        return null;
      }

      // requestAccess prompts the Freighter popup; getAddress reads an already-allowed key.
      const { address, error } = await freighter.requestAccess();
      if (error) {
        setState({ status: "error", message: error.message });
        return null;
      }

      setState({ status: "connected", address });
      return address;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet connection failed.";
      setState({ status: "error", message });
      return null;
    }
  }

  return { state, connect };
}

export type FreighterHook = ReturnType<typeof useFreighter>;
