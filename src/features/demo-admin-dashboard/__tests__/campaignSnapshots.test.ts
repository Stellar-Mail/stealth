import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { defaultCampaignSnapshots } from "../fixtures/campaignSnapshotFixtures";
import { CampaignSnapshot } from "../types/campaignSnapshot";
import { Draft } from "../types/draft";
import {
  saveCampaignSnapshots,
  loadCampaignSnapshots,
  clearCampaignSnapshots,
} from "../persistence/localStorageAdapter";

// Mock localStorage
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

function setWindowStorage() {
  global.window = { localStorage: mockStorage } as unknown as Window & typeof globalThis;
  global.localStorage = mockStorage as unknown as Storage;
}

function clearWindowStorage() {
  delete (global as unknown as { window?: unknown }).window;
  delete (global as unknown as { localStorage?: unknown }).localStorage;
}

describe("Campaign Snapshots Fixtures and Helper logic", () => {
  beforeEach(() => {
    mockStorage.clear();
    setWindowStorage();
  });

  afterEach(() => {
    clearWindowStorage();
  });

  it("should have valid preloaded campaign snapshots", () => {
    expect(defaultCampaignSnapshots.length).toBeGreaterThan(0);
    defaultCampaignSnapshots.forEach((snap) => {
      expect(snap.id).toBeDefined();
      expect(snap.name).toBeDefined();
      expect(snap.description).toBeDefined();
      expect(snap.targetAudience).toBeDefined();
      expect(snap.tags).toBeInstanceOf(Array);
      expect(snap.timestamp).toBeDefined();
      expect(snap.drafts).toBeInstanceOf(Array);
      expect(snap.drafts.length).toBeGreaterThan(0);
    });
  });

  it("should load preloaded snapshots by default", () => {
    const loaded = loadCampaignSnapshots();
    expect(loaded).toEqual(defaultCampaignSnapshots);
  });

  it("should save a new snapshot and retrieve it", () => {
    const newSnapshot: CampaignSnapshot = {
      id: "snap-custom-123",
      name: "Custom Launch Series",
      description: "Tests general product features",
      targetAudience: "General Public",
      tags: ["general", "public"],
      timestamp: "2026-06-16T15:00:00Z",
      drafts: [
        {
          id: "draft-custom-1",
          subject: "Welcome",
          body: "Hello",
          recipients: ["user@example.com"],
        },
      ],
    };

    saveCampaignSnapshots([newSnapshot]);
    const loaded = loadCampaignSnapshots();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(newSnapshot);
  });

  it("should delete a snapshot successfully", () => {
    const customSnapshots: CampaignSnapshot[] = [
      {
        id: "snap-1",
        name: "Snap 1",
        description: "Desc 1",
        targetAudience: "Aud 1",
        tags: [],
        timestamp: "2026-06-16T10:00:00Z",
        drafts: [],
      },
      {
        id: "snap-2",
        name: "Snap 2",
        description: "Desc 2",
        targetAudience: "Aud 2",
        tags: [],
        timestamp: "2026-06-16T11:00:00Z",
        drafts: [],
      },
    ];

    saveCampaignSnapshots(customSnapshots);
    const loadedBeforeDelete = loadCampaignSnapshots();
    expect(loadedBeforeDelete).toHaveLength(2);

    // Perform deletion of snap-1
    const filtered = loadedBeforeDelete.filter((s) => s.id !== "snap-1");
    saveCampaignSnapshots(filtered);

    const loadedAfterDelete = loadCampaignSnapshots();
    expect(loadedAfterDelete).toHaveLength(1);
    expect(loadedAfterDelete[0].id).toBe("snap-2");
  });
});
