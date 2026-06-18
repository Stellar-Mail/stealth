// src/lib/notificationService.ts

/**
 * Simple notification service that persists notifications to localStorage.
 * This works in the browser context. It provides functions to add, update,
 * and retrieve notifications. The `useNotifications` hook will use this
 * service to keep React state in sync.
 */

import type { Notification } from '@/features/notifications/types';

const STORAGE_KEY = 'app_notifications';

function load(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Notification[]) : [];
  } catch {
    return [];
  }
}

function save(notifications: Notification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // ignore storage errors silently
  }
}

export const notificationService = {
  getAll(): Notification[] {
    return load();
  },
  add(notification: Notification) {
    const all = load();
    all.unshift(notification); // newest first
    save(all);
  },
  update(id: string, updates: Partial<Notification>) {
    const all = load().map((n) => (n.id === id ? { ...n, ...updates } : n));
    save(all);
  },
  clearAll() {
    save([]);
  },
};
