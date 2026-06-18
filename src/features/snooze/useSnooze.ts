import { useCallback, useState } from "react";

/** The message currently being snoozed, with just what the dialog needs. */
export type SnoozeTarget = {
  emailId: string;
  subject: string;
};

/**
 * Owns the open/closed state of the snooze dialog. A single instance lives at
 * the route level so every entry point (quick action, reader header, snoozed
 * banner "edit") drives the same dialog over the single email source of truth.
 */
export function useSnooze() {
  const [target, setTarget] = useState<SnoozeTarget | null>(null);

  const open = useCallback((next: SnoozeTarget) => setTarget(next), []);
  const close = useCallback(() => setTarget(null), []);

  return { target, isOpen: target !== null, open, close };
}

export type SnoozeController = ReturnType<typeof useSnooze>;
