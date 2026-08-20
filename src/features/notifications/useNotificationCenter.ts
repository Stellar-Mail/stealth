import { useEffect, useRef, useState } from "react";
import type { MailboxDescriptor, UnknownSenderRequest } from "@/lib/api";
import type { NotificationPreferences } from "@/features/preferences";
import {
  createNotification,
  isWithinQuietHours,
  safeBrowserCopy,
  type InAppNotification,
} from "./logic";

const keyFor = (actor: string) => `stealth-notifications:v1:${actor}`;

export function useNotificationCenter({
  actor,
  mail,
  requests,
  preferences,
  browserEnabled,
}: {
  actor: string | null;
  mail: MailboxDescriptor[];
  requests: UnknownSenderRequest[];
  preferences: NotificationPreferences;
  browserEnabled: boolean;
}) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    seen.current = new Set();
    if (!actor) return setNotifications([]);
    try {
      const stored = JSON.parse(localStorage.getItem(keyFor(actor)) ?? "[]") as InAppNotification[];
      setNotifications(stored);
      stored.forEach((item) => seen.current.add(item.id));
    } catch {
      localStorage.removeItem(keyFor(actor));
      setNotifications([]);
    }
  }, [actor]);

  useEffect(() => {
    if (!actor) return;
    const incoming = [
      ...mail
        .filter((item) => !item.isTombstone)
        .map((item) => ["mail" as const, `mail:${item.messageId}`, item.createdAt] as const),
      ...requests.map(
        (item) => ["requests" as const, `request:${item.requestId}`, item.createdAt] as const,
      ),
    ];
    // First live snapshot is a baseline, avoiding a notification flood on sign-in.
    if (seen.current.size === 0) {
      incoming.forEach(([, id]) => seen.current.add(id));
      return;
    }
    const additions = incoming.filter(
      ([category, id]) => preferences.categories[category] && !seen.current.has(id),
    );
    if (!additions.length) return;
    additions.forEach(([, id]) => seen.current.add(id));
    setNotifications((current) => {
      const next = additions
        .map(([category, id, createdAt]) => createNotification(id, category, createdAt))
        .concat(current)
        .slice(0, 100);
      localStorage.setItem(keyFor(actor), JSON.stringify(next));
      if (
        browserEnabled &&
        !isWithinQuietHours(new Date(), preferences.quietHours) &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        additions.forEach(([category, id]) => {
          const copy = safeBrowserCopy[category];
          new Notification(copy.title, { body: copy.body, tag: id });
        });
      }
      return next;
    });
  }, [actor, browserEnabled, mail, preferences, requests]);

  const persist = (next: InAppNotification[]) => {
    if (actor) localStorage.setItem(keyFor(actor), JSON.stringify(next));
    return next;
  };
  return {
    notifications,
    markRead: (id: string) =>
      setNotifications((current) =>
        persist(current.map((item) => (item.id === id ? { ...item, read: true } : item))),
      ),
    markAllRead: () =>
      setNotifications((current) => persist(current.map((item) => ({ ...item, read: true })))),
  };
}

export async function requestBrowserPermission() {
  if (typeof Notification === "undefined") return "unsupported" as const;
  return Notification.permission === "default"
    ? Notification.requestPermission()
    : Notification.permission;
}
