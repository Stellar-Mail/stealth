import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountProfile, NetworkType, SyncState } from "./types";

const STORAGE_KEY = "stealth-accounts";

/** Initial demo accounts shown on first launch. */
const DEFAULT_ACCOUNTS: AccountProfile[] = [
  {
    id: "personal",
    label: "Personal",
    address: "eve*stealth.xyz",
    federationAddress: "eve*stealth.xyz",
    network: "mainnet",
    avatarInitials: "EN",
    avatarColor: "#4d5560",
    isPinned: true,
    syncState: "synced",
    lastSyncedAt: new Date().toISOString(),
    createdAt: "2026-01-15T08:00:00Z",
  },
  {
    id: "protocol",
    label: "Protocol",
    address: "team*stealth.network",
    federationAddress: "team*stealth.network",
    network: "mainnet",
    avatarInitials: "SP",
    avatarColor: "#6b7280",
    isPinned: true,
    syncState: "synced",
    lastSyncedAt: new Date().toISOString(),
    createdAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "test-org",
    label: "Test Org",
    address: "GCMZ…3KJL",
    network: "testnet",
    avatarInitials: "TO",
    avatarColor: "#5b6470",
    isPinned: false,
    syncState: "offline",
    createdAt: "2026-05-10T14:30:00Z",
  },
];

function loadAccounts(): AccountProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AccountProfile[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore corrupt data; fall through to defaults.
  }
  return DEFAULT_ACCOUNTS;
}

function persistAccounts(accounts: AccountProfile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Storage full or unavailable — silently degrade.
  }
}

export type UseAccountsReturn = {
  accounts: AccountProfile[];
  activeId: string;
  activeAccount: AccountProfile | undefined;
  setActiveAccount: (id: string) => void;
  addAccount: (profile: Omit<AccountProfile, "id" | "createdAt" | "syncState" | "lastSyncedAt" | "isPinned">) => void;
  removeAccount: (id: string) => void;
  renameAccount: (id: string, label: string) => void;
  togglePin: (id: string) => void;
  updateSyncState: (id: string, syncState: SyncState) => void;
};

export function useAccounts(): UseAccountsReturn {
  const [accounts, setAccounts] = useState<AccountProfile[]>(loadAccounts);
  const [activeId, setActiveId] = useState<string>("personal");
  const isInitialRender = useRef(true);

  // Persist to localStorage whenever accounts change (skip initial hydration).
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    persistAccounts(accounts);
  }, [accounts]);

  // Ensure active account still exists in the list.
  useEffect(() => {
    if (!accounts.find((a) => a.id === activeId)) {
      // Fall back to the first account or the first pinned one.
      const fallback = accounts.find((a) => a.isPinned) ?? accounts[0];
      if (fallback) setActiveId(fallback.id);
    }
  }, [accounts, activeId]);

  const activeAccount = accounts.find((a) => a.id === activeId);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const addAccount = useCallback(
    (profile: Omit<AccountProfile, "id" | "createdAt" | "syncState" | "lastSyncedAt" | "isPinned">) => {
      const newAccount: AccountProfile = {
        ...profile,
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        isPinned: false,
        syncState: "syncing",
        createdAt: new Date().toISOString(),
      };
      setAccounts((prev) => [...prev, newAccount]);
    },
    [],
  );

  const removeAccount = useCallback((id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const renameAccount = useCallback((id: string, label: string) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, label } : a)));
  }, []);

  const togglePin = useCallback((id: string) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isPinned: !a.isPinned } : a)),
    );
  }, []);

  const updateSyncState = useCallback((id: string, syncState: SyncState) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, syncState, lastSyncedAt: new Date().toISOString() }
          : a,
      ),
    );
  }, []);

  return {
    accounts,
    activeId,
    activeAccount,
    setActiveAccount: setActive,
    addAccount,
    removeAccount,
    renameAccount,
    togglePin,
    updateSyncState,
  };
}