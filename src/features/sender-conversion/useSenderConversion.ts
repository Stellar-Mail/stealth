import { useCallback, useState } from "react";
import type { SenderConversionTarget } from "./types";

/**
 * Owns the open/closed state of the sender-conversion flow. A single instance
 * lives at the route level so every entry point (request card, sender card,
 * reader header) drives the same dialog and the same single source of truth.
 *
 * Opening the flow is inert: it only records which sender is in focus. No
 * policy changes until the user explicitly confirms inside the dialog.
 */
export function useSenderConversion() {
  const [target, setTarget] = useState<SenderConversionTarget | null>(null);

  const open = useCallback((next: SenderConversionTarget) => setTarget(next), []);
  const close = useCallback(() => setTarget(null), []);

  return {
    target,
    isOpen: target !== null,
    open,
    close,
  };
}

export type SenderConversionController = ReturnType<typeof useSenderConversion>;
