// src/hooks/useNotifications.ts

import { useEffect, useState, useCallback } from 'react';
import { notificationService } from '@/lib/notificationService';
import type { Notification } from '@/features/notifications/types';

/**
 * Hook to manage notifications with persistence via localStorage.
 * Returns the current list (sorted newest first) and helpers.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load on mount
  useEffect(() => {
    setNotifications(notificationService.getAll());
  }, []);

  const addNotification = useCallback((notif: Notification) => {
    notificationService.add(notif);
    setNotifications((prev) => [notif, ...prev]);
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<Notification>) => {
    notificationService.update(id, updates);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    notifications.forEach((n) => {
      if (!n.read) {
        updateNotification(n.id, { read: true });
      }
    });
  }, [notifications, updateNotification]);

  const archiveNotification = useCallback((id: string) => {
    // Simple implementation: remove from list
    notificationService.update(id, { read: true }); // ensure read
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    notifications,
    addNotification,
    updateNotification,
    markAllRead,
    archiveNotification,
    setNotifications,
  };
}
