/**
 * Per-user, per-device mailbox sync checkpoint store (Issue #1941 BETA-034).
 *
 * The default adapter uses localStorage. Tests inject a Map-backed store so
 * concurrent tabs can share one checkpoint without a browser.
 */
import type { MailboxSyncCheckpoint } from "./types";

export interface CheckpointStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const CHECKPOINT_KEY_PREFIX = "stealth.mailbox.checkpoint.";
export const DEVICE_ID_KEY = "stealth.mailbox.deviceId";

export function checkpointKey(actor: string, deviceId: string): string {
  return `${CHECKPOINT_KEY_PREFIX}${actor}.${deviceId}`;
}

export function createMemoryCheckpointStore(
  initial: Map<string, string> = new Map(),
): CheckpointStore & { readonly data: Map<string, string> } {
  const data = initial;
  return {
    data,
    get(key) {
      return data.get(key) ?? null;
    },
    set(key, value) {
      data.set(key, value);
    },
    remove(key) {
      data.delete(key);
    },
  };
}

export function createLocalStorageCheckpointStore(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = getDefaultStorage(),
): CheckpointStore {
  return {
    get(key) {
      return storage?.getItem(key) ?? null;
    },
    set(key, value) {
      storage?.setItem(key, value);
    },
    remove(key) {
      storage?.removeItem(key);
    },
  };
}

function getDefaultStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadOrCreateDeviceId(
  store: CheckpointStore,
  createId: () => string = defaultDeviceId,
): string {
  const existing = store.get(DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = createId();
  store.set(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

function defaultDeviceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadCheckpoint(
  store: CheckpointStore,
  actor: string,
  deviceId: string,
): MailboxSyncCheckpoint | null {
  const raw = store.get(checkpointKey(actor, deviceId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MailboxSyncCheckpoint;
    if (parsed.actor !== actor || parsed.deviceId !== deviceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCheckpoint(store: CheckpointStore, checkpoint: MailboxSyncCheckpoint): void {
  store.set(checkpointKey(checkpoint.actor, checkpoint.deviceId), JSON.stringify(checkpoint));
}

export function clearCheckpoint(store: CheckpointStore, actor: string, deviceId: string): void {
  store.remove(checkpointKey(actor, deviceId));
}
