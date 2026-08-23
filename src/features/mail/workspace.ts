// ---------------------------------------------------------------------------
// BETA-053 (Issue #1960) — local mailbox workspace overlay.
//
// Live queue rows stay the server source of truth. Transient user edits
// (star, archive, snooze, optimistic trash, locally inserted sent mail)
// live in this overlay so a refetch cannot wipe in-progress work, and so
// new server rows still appear. Custody secrets never enter this layer.
// ---------------------------------------------------------------------------

import type { Email } from "@/components/mail/data";

export interface MailWorkspaceOverlay {
  patches: Record<string, Partial<Email>>;
  inserts: Email[];
}

export const EMPTY_MAIL_WORKSPACE: MailWorkspaceOverlay = {
  patches: {},
  inserts: [],
};

/** Merge server rows with local inserts and per-id patches. Inserts lose if the server already has that id. */
export function mergeMailWorkspace(
  serverEmails: Email[],
  overlay: MailWorkspaceOverlay = EMPTY_MAIL_WORKSPACE,
): Email[] {
  const byId = new Map<string, Email>();

  for (const email of overlay.inserts) {
    byId.set(email.id, email);
  }
  for (const email of serverEmails) {
    byId.set(email.id, email);
  }

  return [...byId.values()].map((email) => {
    const patch = overlay.patches[email.id];
    return patch ? { ...email, ...patch } : email;
  });
}

export function applyEmailPatch(
  overlay: MailWorkspaceOverlay,
  id: string,
  patch: Partial<Email>,
): MailWorkspaceOverlay {
  return {
    ...overlay,
    patches: {
      ...overlay.patches,
      [id]: { ...overlay.patches[id], ...patch },
    },
  };
}

export function insertWorkspaceEmail(
  overlay: MailWorkspaceOverlay,
  email: Email,
): MailWorkspaceOverlay {
  if (overlay.inserts.some((item) => item.id === email.id)) {
    return overlay;
  }
  return {
    ...overlay,
    inserts: [email, ...overlay.inserts],
  };
}

/** Restore a single field (used to roll back a failed live mutation). */
export function revertEmailPatch(
  overlay: MailWorkspaceOverlay,
  id: string,
  restore: Partial<Email>,
): MailWorkspaceOverlay {
  return applyEmailPatch(overlay, id, restore);
}
