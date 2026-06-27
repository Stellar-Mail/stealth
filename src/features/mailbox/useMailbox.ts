/**
 * React hook for accessing mailbox data and mutations.
 * Manages loading states, offline detection, and error handling.
 */

import { useEffect, useState, useCallback } from "react";
import { getAdapterInstance } from "@/services/data/factory";
import type { DataAdapter } from "@/services/data/repositories";
import type { Message } from "@/services/data/types";
import type { Email } from "@/components/mail/data";

export type MailboxLoadingState = "idle" | "loading" | "loaded" | "error" | "offline";

export interface MailboxState {
  messages: Email[];
  loadingState: MailboxLoadingState;
  error: string | null;
  isOffline: boolean;
}

export interface MailboxMutations {
  updateMessage: (id: string, changes: Partial<Email>) => Promise<void>;
  bulkUpdateMessages: (updates: Array<{ id: string; changes: Partial<Email> }>) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  retry: () => Promise<void>;
}

/**
 * Hook to access mailbox state and mutations.
 * Handles async initialization and error states.
 */
export function useMailbox(): MailboxState & MailboxMutations {
  const [adapter, setAdapter] = useState<DataAdapter | null>(null);
  const [messages, setMessages] = useState<Email[]>([]);
  const [loadingState, setLoadingState] = useState<MailboxLoadingState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Initialize adapter on mount
  useEffect(() => {
    let mounted = true;

    async function initAdapter() {
      try {
        setLoadingState("loading");
        const adapterInstance = await getAdapterInstance();
        if (mounted) {
          setAdapter(adapterInstance);

          // Load initial messages
          const msgs = await adapterInstance.messages.getAll();
          setMessages(msgs as Email[]);
          setLoadingState("loaded");
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to initialize mailbox");
          setLoadingState("error");
        }
      }
    }

    initAdapter();

    return () => {
      mounted = false;
    };
  }, []);

  // Monitor offline status
  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }

    function handleOffline() {
      setIsOffline(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const updateMessage = useCallback(
    async (id: string, changes: Partial<Email>) => {
      if (!adapter) throw new Error("Adapter not initialized");

      try {
        const message = await adapter.messages.getById(id);
        if (!message) throw new Error("Message not found");

        const updated = { ...message, ...changes };
        await adapter.messages.upsert(updated as Message);

        // Update local state
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update message");
        throw err;
      }
    },
    [adapter],
  );

  const bulkUpdateMessages = useCallback(
    async (updates: Array<{ id: string; changes: Partial<Email> }>) => {
      if (!adapter) throw new Error("Adapter not initialized");

      try {
        const messageUpdates = updates.map(({ id, changes }) => ({
          id,
          changes: changes as Partial<Message>,
        }));

        await adapter.messages.bulkUpdate(messageUpdates);

        // Update local state
        setMessages((prev) => {
          const updateMap = new Map(updates.map((u) => [u.id, u.changes]));
          return prev.map((m) => (updateMap.has(m.id) ? { ...m, ...updateMap.get(m.id) } : m));
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update messages");
        throw err;
      }
    },
    [adapter],
  );

  const deleteMessage = useCallback(
    async (id: string) => {
      if (!adapter) throw new Error("Adapter not initialized");

      try {
        await adapter.messages.delete(id);

        // Update local state
        setMessages((prev) => prev.filter((m) => m.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete message");
        throw err;
      }
    },
    [adapter],
  );

  const retry = useCallback(async () => {
    if (!adapter) return;

    try {
      setLoadingState("loading");
      const msgs = await adapter.messages.getAll();
      setMessages(msgs as Email[]);
      setLoadingState("loaded");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry");
      setLoadingState("error");
    }
  }, [adapter]);

  return {
    messages,
    loadingState,
    error,
    isOffline,
    updateMessage,
    bulkUpdateMessages,
    deleteMessage,
    retry,
  };
}
