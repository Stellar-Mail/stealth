import { useState } from "react";

export type FreighterStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "unavailable"
  | "error";

export type FreighterState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; address: string }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export type FreighterHook = ReturnType<typeof useFreighter>;

export function useFreighter() {
  const [state, setState] = useState<FreighterState>({ status: "idle" });

  async function connect(): Promise<string | null> {
    setState({ status: "connecting" });

    try {
      const freighter = await import("@stellar/freighter-api");

      const { isConnected } = await freighter.isConnected();
      if (!isConnected) {
        setState({ status: "unavailable" });
        return null;
      }

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

  function disconnect(): void {
    setState({ status: "idle" });
  }

  return { state, connect, disconnect };
}