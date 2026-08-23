// ---------------------------------------------------------------------------
// BETA-053 (Issue #1960) — folder / filter / selection helpers.
// Transient navigation is kept out of the server-data layer.
// ---------------------------------------------------------------------------

import {
  getEmailsForFolder,
  mailFolders,
  type Email,
  type MailFolder,
} from "@/components/mail/data";

export function buildFolderCounts(emails: Email[]): Record<MailFolder, number> {
  return Object.fromEntries(
    mailFolders.map((item) => [item.key, getEmailsForFolder(emails, item.key).length]),
  ) as Record<MailFolder, number>;
}

export function emailsInCustomFolder(emails: Email[], customFolder: string): Email[] {
  const needle = customFolder.toLowerCase();
  return emails.filter((email) => email.labels?.some((label) => label.toLowerCase() === needle));
}

export function visibleEmailsFor(
  emails: Email[],
  folder: MailFolder,
  customFolder: string | null,
): Email[] {
  if (customFolder) return emailsInCustomFolder(emails, customFolder);
  return getEmailsForFolder(emails, folder);
}

/** Keep the current thread if it is still visible; otherwise fall back to the first visible row. */
export function nextSelectedId(visibleEmails: Email[], selectedId: string | null): string | null {
  if (visibleEmails.some((email) => email.id === selectedId)) return selectedId;
  return visibleEmails[0]?.id ?? null;
}

export function firstCustomFolderMatch(emails: Email[], customFolder: string): string | null {
  return emailsInCustomFolder(emails, customFolder)[0]?.id ?? null;
}
