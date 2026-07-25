import type { TriageStatus } from '../types';

export type StorageEntry<T> = { id: string; data: T };

export interface StorageAdapter {
  get<T>(key: string): Promise<StorageEntry<T> | null>;
  getAll<T>(prefix: string): Promise<StorageEntry<T>[]>;
  set<T>(key: string, entry: StorageEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
}

export const VALID_TRANSITIONS: Record<TriageStatus, TriageStatus[]> = {
  unassigned: ['claimed'],
  claimed: ['in-progress', 'unassigned'],
  'in-progress': ['awaiting-reply', 'resolved', 'claimed'],
  'awaiting-reply': ['resolved', 'in-progress'],
  resolved: ['claimed'],
};

export function getNextStatuses(current: TriageStatus): TriageStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

export const STATUS_LABELS: Record<TriageStatus, string> = {
  unassigned: 'Unassigned',
  claimed: 'Claimed',
  'in-progress': 'In Progress',
  'awaiting-reply': 'Awaiting Reply',
  resolved: 'Resolved',
};
