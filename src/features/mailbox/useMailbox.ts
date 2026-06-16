import { useEffect, useState, useCallback } from "react";
import type { IMailboxRepository } from "./repository";
import type {
  MailboxContext,
  Message,
  Thread,
  Contact,
  Policy,
  Proof,
  LoadingState,
} from "./types";
import { StorageMailboxAdapter } from "./adapters";

let globalRepository: IMailboxRepository | null = null;

export function setMailboxRepository(repository: IMailboxRepository) {
  globalRepository = repository;
}

function getRepository(): IMailboxRepository {
  if (!globalRepository) {
    globalRepository = new StorageMailboxAdapter();
  }
  return globalRepository;
}

export function useMailbox() {
  const [context, setContext] = useState<MailboxContext>({
    state: {
      version: 1,
      messages: [],
      threads: [],
      contacts: [],
      policy: { allowUnknown: false, minimumPostage: "0", requireVerified: true },
      proofs: [],
      syncCursor: { id: "", timestamp: 0, source: "local" },
    },
    loadingState: "loading",
    error: null,
    lastSync: 0,
  });

  // Load initial state
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        setContext((prev) => ({ ...prev, loadingState: "loading" }));
        const repository = getRepository();
        const state = await repository.getState();

        if (isMounted) {
          setContext({
            state,
            loadingState: "idle",
            error: null,
            lastSync: Date.now(),
          });
        }
      } catch (error) {
        if (isMounted) {
          setContext((prev) => ({
            ...prev,
            loadingState: "error",
            error: error instanceof Error ? error : new Error("Unknown error"),
          }));
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  // Message operations
  const updateMessage = useCallback(async (id: string, updates: Partial<Message>) => {
    try {
      const repository = getRepository();
      await repository.updateMessage(id, updates);
      const state = await repository.getState();
      setContext((prev) => ({ ...prev, state }));
    } catch (error) {
      setContext((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error("Update failed"),
      }));
    }
  }, []);

  const createMessage = useCallback(async (message: Message) => {
    try {
      const repository = getRepository();
      await repository.createMessage(message);
      const state = await repository.getState();
      setContext((prev) => ({ ...prev, state }));
    } catch (error) {
      setContext((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error("Create failed"),
      }));
    }
  }, []);

  const deleteMessage = useCallback(async (id: string) => {
    try {
      const repository = getRepository();
      await repository.deleteMessage(id);
      const state = await repository.getState();
      setContext((prev) => ({ ...prev, state }));
    } catch (error) {
      setContext((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error("Delete failed"),
      }));
    }
  }, []);

  // Thread operations
  const updateThread = useCallback(async (id: string, updates: Partial<Thread>) => {
    try {
      const repository = getRepository();
      await repository.updateThread(id, updates);
      const state = await repository.getState();
      setContext((prev) => ({ ...prev, state }));
    } catch (error) {
      setContext((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error("Thread update failed"),
      }));
    }
  }, []);

  // Contact operations
  const updateContact = useCallback(async (address: string, updates: Partial<Contact>) => {
    try {
      const repository = getRepository();
      await repository.updateContact(address, updates);
      const state = await repository.getState();
      setContext((prev) => ({ ...prev, state }));
    } catch (error) {
      setContext((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error("Contact update failed"),
      }));
    }
  }, []);

  // Policy operations
  const updatePolicy = useCallback(async (policy: Policy) => {
    try {
      const repository = getRepository();
      await repository.setPolicy(policy);
      const state = await repository.getState();
      setContext((prev) => ({ ...prev, state }));
    } catch (error) {
      setContext((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error("Policy update failed"),
      }));
    }
  }, []);

  // Proof operations
  const createProof = useCallback(async (proof: Proof) => {
    try {
      const repository = getRepository();
      await repository.createProof(proof);
      const state = await repository.getState();
      setContext((prev) => ({ ...prev, state }));
    } catch (error) {
      setContext((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error("Proof creation failed"),
      }));
    }
  }, []);

  return {
    state: context.state,
    loadingState: context.loadingState,
    error: context.error,
    lastSync: context.lastSync,
    messages: {
      update: updateMessage,
      create: createMessage,
      delete: deleteMessage,
    },
    threads: {
      update: updateThread,
    },
    contacts: {
      update: updateContact,
    },
    policy: {
      update: updatePolicy,
    },
    proofs: {
      create: createProof,
    },
  };
}
