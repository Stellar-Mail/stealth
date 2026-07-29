import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  isEntryUnread,
  hasUnreadEntries,
  groupEntriesByRelease,
  getCategoryLabel,
  CATEGORY_CONFIG,
  STORAGE_KEY,
  getSeenVersion,
  setSeenVersion,
} from "../../../src/features/changelog/helpers";
import { CHANGELOG_ENTRIES, LATEST_VERSION } from "../../../src/features/changelog/data";
import type { ChangelogEntry } from "../../../src/features/changelog/types";

// ---------------------------------------------------------------------------
// Deterministic test fixtures — no real user data
// ---------------------------------------------------------------------------

const FAKE_ENTRIES: ChangelogEntry[] = [
  {
    id: "v2.0.0-ui-1",
    version: "2.0.0",
    date: "2026-03-15",
    category: "ui",
    title: "Dashboard overhaul",
    description: "Completely redesigned dashboard with real-time widgets.",
  },
  {
    id: "v2.0.0-api-1",
    version: "2.0.0",
    date: "2026-03-15",
    category: "api",
    title: "REST v2 endpoints",
    description: "New versioned API surface with breaking changes documented.",
    link: { label: "Migration guide", href: "https://example.com/migrate" },
  },
  {
    id: "v1.1.0-security-1",
    version: "1.1.0",
    date: "2026-02-01",
    category: "security",
    title: "2FA enforcement",
    description: "Two-factor authentication is now required for admin accounts.",
  },
  {
    id: "v1.0.0-protocol-1",
    version: "1.0.0",
    date: "2026-01-10",
    category: "protocol",
    title: "Initial release",
    description: "First stable protocol release.",
  },
];

// ---------------------------------------------------------------------------
// data.ts — structural integrity
// ---------------------------------------------------------------------------

describe("CHANGELOG_ENTRIES data integrity", () => {
  it("contains at least one entry", () => {
    expect(CHANGELOG_ENTRIES.length).toBeGreaterThanOrEqual(1);
  });

  it("every entry has a non-empty id, version, date, category, title, and description", () => {
    for (const entry of CHANGELOG_ENTRIES) {
      expect(entry.id).toBeTruthy();
      expect(entry.version).toBeTruthy();
      expect(entry.date).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });

  it("has unique ids across all entries", () => {
    const ids = CHANGELOG_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("LATEST_VERSION equals the version of the first entry", () => {
    expect(LATEST_VERSION).toBe(CHANGELOG_ENTRIES[0].version);
  });

  it("every entry date is a valid ISO date string", () => {
    for (const entry of CHANGELOG_ENTRIES) {
      const parsed = new Date(entry.date);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
    }
  });

  it("link entries have both label and href when present", () => {
    const withLinks = CHANGELOG_ENTRIES.filter((e) => e.link);
    for (const entry of withLinks) {
      expect(entry.link!.label).toBeTruthy();
      expect(entry.link!.href).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// isEntryUnread
// ---------------------------------------------------------------------------

describe("isEntryUnread", () => {
  it("returns true for every version when seenVersion is null (first visit)", () => {
    expect(isEntryUnread("0.1.0", null)).toBe(true);
    expect(isEntryUnread("9.9.9", null)).toBe(true);
  });

  it("returns true when entryVersion is newer than seenVersion", () => {
    expect(isEntryUnread("0.4.0", "0.3.2")).toBe(true);
  });

  it("returns false when entryVersion matches seenVersion exactly", () => {
    expect(isEntryUnread("0.3.2", "0.3.2")).toBe(false);
  });

  it("returns false when entryVersion is older than seenVersion", () => {
    expect(isEntryUnread("0.3.0", "0.3.2")).toBe(false);
  });

  it("handles single-digit version strings", () => {
    expect(isEntryUnread("2", "1")).toBe(true);
    expect(isEntryUnread("1", "2")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasUnreadEntries
// ---------------------------------------------------------------------------

describe("hasUnreadEntries", () => {
  it("returns true when seenVersion is null", () => {
    expect(hasUnreadEntries("0.4.0", null)).toBe(true);
  });

  it("returns true when seenVersion differs from latestVersion", () => {
    expect(hasUnreadEntries("0.4.0", "0.3.0")).toBe(true);
  });

  it("returns false when seenVersion matches latestVersion", () => {
    expect(hasUnreadEntries("0.4.0", "0.4.0")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// groupEntriesByRelease
// ---------------------------------------------------------------------------

describe("groupEntriesByRelease", () => {
  it("groups entries sharing the same version and date under one key", () => {
    const groups = groupEntriesByRelease(FAKE_ENTRIES);
    const keys = Object.keys(groups);

    // v2.0.0 has 2 entries on same date, v1.1.0 has 1, v1.0.0 has 1
    expect(keys).toHaveLength(3);
    expect(groups["2.0.0|2026-03-15"]).toHaveLength(2);
    expect(groups["1.1.0|2026-02-01"]).toHaveLength(1);
    expect(groups["1.0.0|2026-01-10"]).toHaveLength(1);
  });

  it("returns an empty object for an empty array", () => {
    const groups = groupEntriesByRelease([]);
    expect(Object.keys(groups)).toHaveLength(0);
  });

  it("preserves insertion order of keys", () => {
    const groups = groupEntriesByRelease(FAKE_ENTRIES);
    const keys = Object.keys(groups);

    expect(keys[0]).toBe("2.0.0|2026-03-15");
    expect(keys[1]).toBe("1.1.0|2026-02-01");
    expect(keys[2]).toBe("1.0.0|2026-01-10");
  });

  it("creates separate groups for same version on different dates", () => {
    const entries: ChangelogEntry[] = [
      {
        id: "a",
        version: "1.0.0",
        date: "2026-01-01",
        category: "ui",
        title: "A",
        description: "A",
      },
      {
        id: "b",
        version: "1.0.0",
        date: "2026-01-02",
        category: "ui",
        title: "B",
        description: "B",
      },
    ];

    const groups = groupEntriesByRelease(entries);
    expect(Object.keys(groups)).toHaveLength(2);
    expect(groups["1.0.0|2026-01-01"]).toHaveLength(1);
    expect(groups["1.0.0|2026-01-02"]).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// CATEGORY_CONFIG & getCategoryLabel
// ---------------------------------------------------------------------------

describe("CATEGORY_CONFIG", () => {
  it("has entries for all known categories", () => {
    expect(CATEGORY_CONFIG).toHaveProperty("ui");
    expect(CATEGORY_CONFIG).toHaveProperty("api");
    expect(CATEGORY_CONFIG).toHaveProperty("protocol");
    expect(CATEGORY_CONFIG).toHaveProperty("security");
  });

  it("each config has a non-empty label and styles string", () => {
    for (const [, config] of Object.entries(CATEGORY_CONFIG)) {
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.styles.length).toBeGreaterThan(0);
    }
  });
});

describe("getCategoryLabel", () => {
  it("returns the display label for known categories", () => {
    expect(getCategoryLabel("ui")).toBe("UI");
    expect(getCategoryLabel("api")).toBe("API");
    expect(getCategoryLabel("protocol")).toBe("Protocol");
    expect(getCategoryLabel("security")).toBe("Security");
  });

  it("falls back to raw category string for unknown categories", () => {
    expect(getCategoryLabel("experimental")).toBe("experimental");
    expect(getCategoryLabel("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// getSeenVersion / setSeenVersion (localStorage interaction)
// ---------------------------------------------------------------------------

describe("getSeenVersion / setSeenVersion", () => {
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    if (typeof localStorage === "undefined") {
      originalLocalStorage = globalThis.localStorage;
      const store = new Map<string, string>();
      const mockStorage: Storage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => store.clear(),
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        get length() {
          return store.size;
        },
      };
      Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        configurable: true,
        writable: true,
      });
    } else {
      localStorage.clear();
    }
  });

  afterEach(() => {
    if (localStorage) {
      localStorage.clear();
    }
  });

  it("returns null when no version has been stored", () => {
    expect(getSeenVersion()).toBeNull();
  });

  it("round-trips a stored version", () => {
    setSeenVersion("0.4.0");
    expect(getSeenVersion()).toBe("0.4.0");
  });

  it("overwrites a previously stored version", () => {
    setSeenVersion("0.3.0");
    setSeenVersion("0.4.0");
    expect(getSeenVersion()).toBe("0.4.0");
  });

  it("uses the expected storage key", () => {
    setSeenVersion("1.0.0");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1.0.0");
  });
});
