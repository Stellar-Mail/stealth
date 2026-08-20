/**
 * React hook that drives incremental mailbox sync (Issue #1941 BETA-034).
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { applySyncEvents } from "./apply-events";
import { createLocalStorageCheckpointStore } from "./sync-checkpoint";
import { createDocumentVisibility, MailboxSyncEngine } from "./sync-engine";
import type { SyncedMailboxMessage } from "./types";

export interface UseMailboxSyncOptions {
  actor?: string | null;
  enabled?: boolean;
}

export function useMailboxSync(options: UseMailboxSyncOptions) {
  const [messages, setMessages] = useState<SyncedMailboxMessage[]>([]);
  const engineRef = useRef<MailboxSyncEngine | null>(null);
  const store = useMemo(() => createLocalStorageCheckpointStore(), []);

  useEffect(() => {
    if (!options.actor || options.enabled === false) {
      engineRef.current = null;
      return;
    }

    const engine = new MailboxSyncEngine({
      actor: options.actor,
      store,
      visibility: createDocumentVisibility(),
      onChange: (next) => setMessages([...next.values()]),
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      void engine.stop();
      engineRef.current = null;
    };
  }, [options.actor, options.enabled, store]);

  return {
    messages,
    engine: engineRef.current,
  };
}

export { applySyncEvents };
