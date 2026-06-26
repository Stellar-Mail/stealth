import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  retentionMs,
  retentionLabel,
  defaultRetentionForSource,
  saveSession,
  loadSessions,
  cleanExpiredSessions,
  clearSessions,
} from "@/features/contacts/import/dataRetention";
import type { ImportSession } from "@/features/contacts/import/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<ImportSession> = {}): ImportSession {
  return {
    id: "test-session",
    source: "csv",
    createdAt: new Date().toISOString(),
    rawDataRetention: "session",
    contactCount: 10,
    assignedCount: 8,
    policyWrites: 8,
    bulkWrite: null,
    ...overrides,
  };
}

// ─── localStorage mock ────────────────────────────────────────────────────────

function mockLocalStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
  vi.stubGlobal("localStorage", storage);
  return { store, storage };
}

// ─── retentionMs ──────────────────────────────────────────────────────────────

describe("retentionMs", () => {
  it("returns 0 for session retention", () => {
    expect(retentionMs("session")).toBe(0);
  });

  it("returns 3_600_000 for 1h retention", () => {
    expect(retentionMs("1h")).toBe(3_600_000);
  });

  it("returns 86_400_000 for 24h retention", () => {
    expect(retentionMs("24h")).toBe(86_400_000);
  });

  it("returns 604_800_000 for 7d retention", () => {
    expect(retentionMs("7d")).toBe(604_800_000);
  });

  it("returns Infinity for never retention", () => {
    expect(retentionMs("never")).toBe(Infinity);
  });
});

// ─── retentionLabel ───────────────────────────────────────────────────────────

describe("retentionLabel", () => {
  it("returns human-readable labels for each policy", () => {
    expect(retentionLabel("session")).toContain("Discarded");
    expect(retentionLabel("1h")).toContain("1 hour");
    expect(retentionLabel("24h")).toContain("24 hours");
    expect(retentionLabel("7d")).toContain("7 days");
    expect(retentionLabel("never")).toContain("Kept");
  });
});

// ─── defaultRetentionForSource ────────────────────────────────────────────────

describe("defaultRetentionForSource", () => {
  it("returns session for csv", () => {
    expect(defaultRetentionForSource("csv")).toBe("session");
  });

  it("returns 24h for provider sources", () => {
    expect(defaultRetentionForSource("provider-gmail")).toBe("24h");
    expect(defaultRetentionForSource("provider-outlook")).toBe("24h");
  });

  it("returns 24h for contacts-api", () => {
    expect(defaultRetentionForSource("contacts-api")).toBe("24h");
  });

  it("returns session for manual", () => {
    expect(defaultRetentionForSource("manual")).toBe("session");
  });
});

// ─── saveSession / loadSessions / clearSessions ───────────────────────────────

describe("saveSession / loadSessions / clearSessions", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("saves and loads a session", () => {
    const session = makeSession();
    saveSession(session);

    const loaded = loadSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("test-session");
    expect(loaded[0].contactCount).toBe(10);
  });

  it("maintains multiple sessions in order (most recent first)", () => {
    const oldest = makeSession({ id: "oldest", createdAt: "2024-01-01T00:00:00Z" });
    const newest = makeSession({ id: "newest", createdAt: "2024-06-01T00:00:00Z" });

    saveSession(oldest);
    saveSession(newest);

    const loaded = loadSessions();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe("newest");
    expect(loaded[1].id).toBe("oldest");
  });

  it("caps sessions at MAX_SESSIONS", () => {
    for (let i = 0; i < 15; i++) {
      saveSession(makeSession({ id: `session-${i}` }));
    }

    const loaded = loadSessions();
    expect(loaded).toHaveLength(10);
  });

  it("clears all sessions", () => {
    saveSession(makeSession());
    clearSessions();
    expect(loadSessions()).toHaveLength(0);
  });

  it("returns empty array when nothing is stored", () => {
    expect(loadSessions()).toEqual([]);
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem("stealth-import-sessions", "not-json");
    expect(loadSessions()).toEqual([]);
  });

  it("handles localStorage quota errors gracefully", () => {
    // Simulate storage full
    localStorage.setItem = vi.fn().mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => {
      saveSession(makeSession());
    }).not.toThrow();
  });
});

// ─── cleanExpiredSessions ─────────────────────────────────────────────────────

describe("cleanExpiredSessions", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("removes expired session-only sessions", () => {
    saveSession(makeSession({ id: "s1", rawDataRetention: "session" }));
    const removed = cleanExpiredSessions();
    expect(removed).toBe(1);
    expect(loadSessions()).toHaveLength(0);
  });

  it("keeps sessions with never retention", () => {
    saveSession(makeSession({ id: "s1", rawDataRetention: "never" }));
    const removed = cleanExpiredSessions();
    expect(removed).toBe(0);
    expect(loadSessions()).toHaveLength(1);
  });

  it("removes expired 1h sessions", () => {
    const past = new Date(Date.now() - 3_600_001).toISOString(); // just over 1h
    saveSession(makeSession({ id: "s1", rawDataRetention: "1h", createdAt: past }));
    const removed = cleanExpiredSessions();
    expect(removed).toBe(1);
  });

  it("keeps fresh 1h sessions", () => {
    const recent = new Date().toISOString();
    saveSession(makeSession({ id: "s1", rawDataRetention: "1h", createdAt: recent }));
    const removed = cleanExpiredSessions();
    expect(removed).toBe(0);
  });

  it("handles corrupt data gracefully", () => {
    localStorage.setItem("stealth-import-sessions", "not-json");
    const removed = cleanExpiredSessions();
    expect(removed).toBe(0);
  });

  it("handles localStorage write errors gracefully", () => {
    localStorage.setItem = vi.fn().mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const removed = cleanExpiredSessions();
    expect(removed).toBe(0);
  });
});
