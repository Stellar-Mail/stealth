// src/features/demo-admin-dashboard/persistence/localStorageAdapter.ts
export interface StorageAdapter<T> {
  /** Save a value under a given key */
  save(key: string, value: T): void;
  /** Load a value by key; returns null if missing or parse error */
  load(key: string): T | null;
  /** Remove a value from storage */
  clear(key: string): void;
}

/**
 * Simple wrapper around the browser's `localStorage` that serialises values as JSON.
 * It is generic so it can be reused for any type (e.g., the Draft state).
 */
export class LocalStorageAdapter<T> implements StorageAdapter<T> {
  save(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      (globalThis as any).localStorage.setItem(key, serialized);
    } catch (e) {
      // In a demo context we simply log – production code would surface the error.
      console.error("LocalStorageAdapter.save error", e);
    }
  }

  load(key: string): T | null {
    try {
      const raw = (globalThis as any).localStorage.getItem(key) as string | null;
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.error("LocalStorageAdapter.load error", e);
      return null;
    }
  }

  clear(key: string): void {
    try {
      (globalThis as any).localStorage.removeItem(key);
    } catch (e) {
      console.error("LocalStorageAdapter.clear error", e);
    }
  }
}

// Convenience helpers for Draft state persistence
import { Draft } from "../types/draft";
import { CampaignTag } from "../types/campaignTag";
import { defaultCampaignTags } from "../fixtures/campaignTagFixtures";
import { CampaignSnapshot } from "../types/campaignSnapshot";
import { defaultCampaignSnapshots } from "../fixtures/campaignSnapshotFixtures";

const draftAdapter = new LocalStorageAdapter<Draft>();
const DRAFT_KEY = "demoAdminDraft";

export function saveDraft(draft: Draft): void {
  draftAdapter.save(DRAFT_KEY, draft);
}

export function loadDraft(): Draft | null {
  return draftAdapter.load(DRAFT_KEY);
}

export function clearDraft(): void {
  draftAdapter.clear(DRAFT_KEY);
}

// Active draft dataset persistence
const datasetAdapter = new LocalStorageAdapter<Draft[]>();
const DATASET_KEY = "demoAdminDraftDataset";

export function saveDraftDataset(dataset: Draft[]): void {
  datasetAdapter.save(DATASET_KEY, dataset);
}

export function loadDraftDataset(): Draft[] | null {
  return datasetAdapter.load(DATASET_KEY);
}

export function clearDraftDataset(): void {
  datasetAdapter.clear(DATASET_KEY);
}

// Campaign snapshots persistence
const snapshotAdapter = new LocalStorageAdapter<CampaignSnapshot[]>();
const SNAPSHOTS_KEY = "demoAdminCampaignSnapshots";

export function saveCampaignSnapshots(snapshots: CampaignSnapshot[]): void {
  snapshotAdapter.save(SNAPSHOTS_KEY, snapshots);
}

export function loadCampaignSnapshots(): CampaignSnapshot[] {
  const loaded = snapshotAdapter.load(SNAPSHOTS_KEY);
  if (loaded === null) {
    return defaultCampaignSnapshots;
  }
  return loaded;
}

export function clearCampaignSnapshots(): void {
  snapshotAdapter.clear(SNAPSHOTS_KEY);
}

// Campaign tags persistence
const tagAdapter = new LocalStorageAdapter<CampaignTag[]>();
const TAGS_KEY = "demoAdminCampaignTags";

export function saveCampaignTags(tags: CampaignTag[]): void {
  tagAdapter.save(TAGS_KEY, tags);
}

export function loadCampaignTags(): CampaignTag[] {
  const loaded = tagAdapter.load(TAGS_KEY);
  if (loaded === null) {
    return defaultCampaignTags;
  }
  return loaded;
}

export function clearCampaignTags(): void {
  tagAdapter.clear(TAGS_KEY);
}

// Segment editor state persistence
import { SegmentEditorState } from "../types/segmentEditorState";

const segmentEditorAdapter = new LocalStorageAdapter<SegmentEditorState>();
const SEGMENT_EDITOR_KEY = "stealth-demo-segment-editor";

export function saveSegmentEditorState(state: SegmentEditorState): void {
  segmentEditorAdapter.save(SEGMENT_EDITOR_KEY, state);
}

export function loadSegmentEditorState(): SegmentEditorState | null {
  return segmentEditorAdapter.load(SEGMENT_EDITOR_KEY);
}

export function clearSegmentEditorState(): void {
  segmentEditorAdapter.clear(SEGMENT_EDITOR_KEY);
}

// Campaign message assignment persistence
import { AssignmentState } from "../types/assignment";

const assignmentsAdapter = new LocalStorageAdapter<AssignmentState>();
const ASSIGNMENTS_KEY = "stealth-demo-assignments";

export function saveAssignments(state: AssignmentState): void {
  assignmentsAdapter.save(ASSIGNMENTS_KEY, state);
}

export function loadAssignments(): AssignmentState | null {
  return assignmentsAdapter.load(ASSIGNMENTS_KEY);
}

export function clearAssignments(): void {
  assignmentsAdapter.clear(ASSIGNMENTS_KEY);
}
