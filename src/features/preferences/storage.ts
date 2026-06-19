/**
 * Small localStorage-backed external store for preferences.
 *
 * Reading is synchronous and cached, so React can derive the initial preference
 * snapshot on the first render without an extra hydration pass. Writes notify
 * all subscribers, and the native `storage` event keeps tabs/devices in sync.
 */

export interface LocalStorageStore<T> {
  getSnapshot: () => string;
  getValue: () => T;
  set: (value: T | ((prev: T) => T)) => void;
  subscribe: (callback: () => void) => () => void;
}

export function createLocalStorageStore<T>(
  key: string,
  fallback: T,
  options?: { legacyKey?: string },
): LocalStorageStore<T> {
  let cachedRaw: string | null = null;
  let cachedValue: T | undefined;

  function readRaw(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function readLegacy(): Partial<T> | undefined {
    if (!options?.legacyKey || typeof window === "undefined") return undefined;
    try {
      const raw = window.localStorage.getItem(options.legacyKey);
      if (!raw) return undefined;
      return JSON.parse(raw) as Partial<T>;
    } catch {
      return undefined;
    }
  }

  function parse(raw: string | null): T {
    if (!raw) {
      const legacy = readLegacy();
      return legacy ? ({ ...fallback, ...legacy } as T) : fallback;
    }
    try {
      return { ...fallback, ...JSON.parse(raw) } as T;
    } catch {
      return fallback;
    }
  }

  function getSnapshot(): string {
    if (cachedRaw !== null) return cachedRaw;
    const raw = readRaw();
    cachedValue = parse(raw);
    cachedRaw = raw ?? JSON.stringify(cachedValue);
    return cachedRaw;
  }

  function getValue(): T {
    getSnapshot();
    return cachedValue as T;
  }

  const listeners = new Set<() => void>();

  function subscribe(callback: () => void): () => void {
    listeners.add(callback);
    if (typeof window === "undefined") {
      return () => {
        listeners.delete(callback);
      };
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      cachedRaw = null;
      callback();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(callback);
      window.removeEventListener("storage", onStorage);
    };
  }

  function set(value: T | ((prev: T) => T)): void {
    const prev = getValue();
    const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
    try {
      const raw = JSON.stringify(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, raw);
      }
      cachedRaw = raw;
      cachedValue = next;
      listeners.forEach((fn) => fn());
    } catch {
      // Ignore quota/security errors so preferences don't crash the app.
    }
  }

  return { getSnapshot, getValue, set, subscribe };
}
