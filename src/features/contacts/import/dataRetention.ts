import type { DataRetentionPolicy, ImportSession, ImportSource } from "./types";

const SESSION_KEY = "stealth-import-sessions";
const MAX_SESSIONS = 10;

/**
 * Retention window in milliseconds.
 */
export function retentionMs(policy: DataRetentionPolicy): number {
  switch (policy) {
    case "session":
      return 0;
    case "1h":
      return 3_600_000;
    case "24h":
      return 86_400_000;
    case "7d":
      return 604_800_000;
    case "never":
      return Infinity;
  }
}

/**
 * Human-readable retention label.
 */
export function retentionLabel(policy: DataRetentionPolicy): string {
  switch (policy) {
    case "session":
      return "Discarded when you close this window";
    case "1h":
      return "Auto-deleted after 1 hour";
    case "24h":
      return "Auto-deleted after 24 hours";
    case "7d":
      return "Auto-deleted after 7 days";
    case "never":
      return "Kept until you manually delete";
  }
}

/**
 * Default retention policy per import source.
 */
export function defaultRetentionForSource(source: ImportSource): DataRetentionPolicy {
  switch (source) {
    case "csv":
      return "session";
    case "provider-gmail":
    case "provider-outlook":
      return "24h";
    case "contacts-api":
      return "24h";
    case "manual":
      return "session";
  }
}

export type ImportSessionRecord = {
  id: string;
  source: ImportSource;
  createdAt: string;
  rawDataRetention: DataRetentionPolicy;
  contactCount: number;
  assignedCount: number;
  policyWrites: number;
};

/**
 * Persist an import session record to localStorage.
 */
export function saveSession(session: ImportSession): void {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const sessions: ImportSessionRecord[] = raw ? JSON.parse(raw) : [];

    sessions.unshift({
      id: session.id,
      source: session.source,
      createdAt: session.createdAt,
      rawDataRetention: session.rawDataRetention,
      contactCount: session.contactCount,
      assignedCount: session.assignedCount,
      policyWrites: session.policyWrites,
    });

    if (sessions.length > MAX_SESSIONS) {
      sessions.length = MAX_SESSIONS;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
  } catch {
    // storage full
  }
}

/**
 * Load import session history.
 */
export function loadSessions(): ImportSessionRecord[] {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Remove expired raw data.
 * Returns the number of cleaned sessions.
 */
export function cleanExpiredSessions(): number {
  const sessions = loadSessions();
  const now = Date.now();
  const remaining = sessions.filter((s) => {
    const ms = retentionMs(s.rawDataRetention);
    if (ms === Infinity) return true;
    if (ms === 0) return false;
    return now - new Date(s.createdAt).getTime() < ms;
  });

  const removed = sessions.length - remaining.length;
  if (removed > 0) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(remaining));
    } catch {
      // ignore
    }
  }

  return removed;
}

/**
 * Clear all import session history.
 */
export function clearSessions(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
