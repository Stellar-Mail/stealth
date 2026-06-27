import { useCallback, useState } from "react";
import type { SenderIdentityTarget } from "./types";

export function useSenderIdentity() {
  const [target, setTarget] = useState<SenderIdentityTarget | null>(null);

  const open = useCallback((next: SenderIdentityTarget) => setTarget(next), []);
  const close = useCallback(() => setTarget(null), []);

  return {
    target,
    isOpen: target !== null,
    open,
    close,
  };
}

export type SenderIdentityController = ReturnType<typeof useSenderIdentity>;
