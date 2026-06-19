import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { saveDraft, loadDraft, clearDraft } from "../persistence/localStorageAdapter";
import { Draft } from "../types/draft";

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

// Helper to attach mock to global window and globalThis
function setWindowStorage() {
  // @ts-ignore
  global.window = { localStorage: mockStorage } as any;
  // @ts-ignore
  global.localStorage = mockStorage;
}

function clearWindowStorage() {
  // @ts-ignore
  delete (global as any).window;
  // @ts-ignore
  delete (global as any).localStorage;
}

describe("localStorageAdapter", () => {
  beforeEach(() => {
    mockStorage.clear();
    setWindowStorage();
  });

  afterEach(() => {
    clearWindowStorage();
  });

  const draft: Draft = {
    id: "draft-123",
    subject: "Test Subject",
    body: "Test body content",
    recipients: ["alice@example.com"],
  };

  it("saves a draft to localStorage", () => {
    saveDraft(draft);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
    const [key, value] = mockStorage.setItem.mock.calls[0];
    expect(key).toBe("demoAdminDraft");
    expect(JSON.parse(value as string)).toEqual(draft);
  });

  it("loads a draft from localStorage", () => {
    // Pre‑populate mock storage
    mockStorage.setItem("demoAdminDraft", JSON.stringify(draft));
    const loaded = loadDraft();
    expect(mockStorage.getItem).toHaveBeenCalledWith("demoAdminDraft");
    expect(loaded).toEqual(draft);
  });

  it("returns null when no draft is stored", () => {
    const loaded = loadDraft();
    expect(loaded).toBeNull();
  });

  it("clears the stored draft", () => {
    // Store first
    saveDraft(draft);
    clearDraft();
    expect(mockStorage.removeItem).toHaveBeenCalledWith("demoAdminDraft");
    // After clearing, loadDraft should return null
    const afterClear = loadDraft();
    expect(afterClear).toBeNull();
  });
});

import {
  saveDraftDataset,
  loadDraftDataset,
  clearDraftDataset,
  saveCampaignSnapshots,
  loadCampaignSnapshots,
  clearCampaignSnapshots,
} from "../persistence/localStorageAdapter";
import { CampaignSnapshot } from "../types/campaignSnapshot";
import { defaultCampaignSnapshots } from "../fixtures/campaignSnapshotFixtures";

describe("localStorageAdapter - Draft Dataset and Campaign Snapshots", () => {
  beforeEach(() => {
    mockStorage.clear();
    setWindowStorage();
  });

  afterEach(() => {
    clearWindowStorage();
  });

  const dataset: Draft[] = [
    {
      id: "draft-1",
      subject: "Subject 1",
      body: "Body 1",
      recipients: ["r1@example.com"],
    },
    {
      id: "draft-2",
      subject: "Subject 2",
      body: "Body 2",
      recipients: ["r2@example.com"],
    },
  ];

  const snapshots: CampaignSnapshot[] = [
    {
      id: "snap-1",
      name: "Custom Snapshot",
      description: "A custom snapshot description",
      targetAudience: "Beta Users",
      tags: ["tag1"],
      timestamp: "2026-06-16T10:00:00Z",
      drafts: dataset,
    },
  ];

  it("saves and loads a draft dataset", () => {
    saveDraftDataset(dataset);
    const loaded = loadDraftDataset();
    expect(loaded).toEqual(dataset);
  });

  it("returns null when no dataset is stored", () => {
    const loaded = loadDraftDataset();
    expect(loaded).toBeNull();
  });

  it("clears the draft dataset", () => {
    saveDraftDataset(dataset);
    clearDraftDataset();
    expect(loadDraftDataset()).toBeNull();
  });

  it("saves and loads campaign snapshots", () => {
    saveCampaignSnapshots(snapshots);
    const loaded = loadCampaignSnapshots();
    expect(loaded).toEqual(snapshots);
  });

  it("returns preloaded default snapshots when no snapshots are stored", () => {
    const loaded = loadCampaignSnapshots();
    expect(loaded).toEqual(defaultCampaignSnapshots);
  });

  it("clears campaign snapshots and returns defaults", () => {
    saveCampaignSnapshots(snapshots);
    clearCampaignSnapshots();
    expect(loadCampaignSnapshots()).toEqual(defaultCampaignSnapshots);
  });
});
