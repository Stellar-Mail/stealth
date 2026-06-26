import { deriveProof, mailFolders, type Email, type MailFolder } from "@/components/mail/data";
import {
  COMMAND_GROUP_LABEL,
  buildCommands,
  type CommandContext,
  type CommandGroupId,
  type ResolvedCommand,
} from "./types";

export type SettingShortcut = { id: string; label: string; keywords: string[] };

/** Searchable jump targets into the settings modal. */
export const SETTINGS_SHORTCUTS: SettingShortcut[] = [
  {
    id: "unknown-senders",
    label: "Unknown sender policy",
    keywords: ["policy", "senders", "spam"],
  },
  { id: "minimum-postage", label: "Minimum postage", keywords: ["postage", "fee", "xlm", "price"] },
  {
    id: "appearance",
    label: "Appearance & theme",
    keywords: ["theme", "dark", "light", "avatars"],
  },
  {
    id: "notifications",
    label: "Notifications",
    keywords: ["alerts", "sound", "desktop", "email"],
  },
];

/**
 * Internal helper for subsequencing a query that has already been trimmed and lowercased.
 */
function fuzzyScorePrepared(q: string, text: string): number {
  if (!q) return 0;
  const t = text.toLowerCase();

  let score = 0;
  let qi = 0;
  let streak = 0;
  let prevMatch = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;
    let gain = 1;
    if (prevMatch === ti - 1) {
      streak += 1;
      gain += streak * 2;
    } else {
      streak = 0;
    }
    if (ti === 0 || /[\s\-_.@*]/.test(t[ti - 1])) gain += 3;
    score += gain;
    prevMatch = ti;
    qi += 1;
  }

  if (qi < q.length) return -1;
  return score - t.length * 0.01;
}

/**
 * Subsequence fuzzy score. Returns -1 when the query isn't a subsequence of the
 * text; otherwise higher is better. Rewards consecutive runs and word-boundary
 * hits, and lightly prefers shorter targets. O(text length) — cheap enough to
 * run across the whole dataset on every keystroke.
 */
export function fuzzyScore(query: string, text: string): number {
  return fuzzyScorePrepared(query.trim().toLowerCase(), text);
}

export type PaletteRow =
  | { type: "command"; key: string; command: ResolvedCommand }
  | { type: "folder"; key: string; folder: MailFolder; label: string }
  | { type: "sender"; key: string; email: Email }
  | { type: "proof"; key: string; email: Email; proof: string }
  | { type: "setting"; key: string; setting: SettingShortcut };

export type PaletteSection = { id: string; title: string; rows: PaletteRow[] };

// Protocol/delivery surfaced first — they are the point of the control plane.
const GROUP_ORDER: CommandGroupId[] = ["protocol", "delivery", "message", "navigation", "app"];

const PER_GROUP_CAP = 5;

let lastEmails: Email[] | null = null;
let cachedUniqueSenders: Email[] = [];

function getUniqueSenders(emails: Email[]): Email[] {
  if (emails === lastEmails) return cachedUniqueSenders;
  const seen = new Set<string>();
  const unique = emails.filter((email) => {
    if (seen.has(email.email)) return false;
    seen.add(email.email);
    return true;
  });
  lastEmails = emails;
  cachedUniqueSenders = unique;
  return unique;
}

function rank<T>(items: T[], query: string, toText: (item: T) => string, cap: number): T[] {
  const q = query.trim().toLowerCase();
  const scored: { item: T; score: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const score = fuzzyScorePrepared(q, toText(item));
    if (score >= 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const result: T[] = [];
  const limit = Math.min(scored.length, cap);
  for (let i = 0; i < limit; i++) {
    result.push(scored[i].item);
  }
  return result;
}

/**
 * Build the grouped palette model for a context + query.
 *
 * Empty query → contextual command groups (the control plane at rest), with
 * invalid commands still shown so their help text teaches why. Non-empty query
 * → fuzzy results across commands, folders, senders, proofs, and settings.
 */
export function buildPaletteModel(
  ctx: CommandContext,
  query: string,
  emails: Email[],
): PaletteSection[] {
  const commands = buildCommands(ctx);
  const q = query.trim();

  if (!q) {
    return GROUP_ORDER.map((group) => ({
      id: `cmd-${group}`,
      title: COMMAND_GROUP_LABEL[group],
      rows: commands
        .filter((command) => command.group === group)
        .map((command) => ({ type: "command" as const, key: command.id, command })),
    })).filter((section) => section.rows.length > 0);
  }

  const sections: PaletteSection[] = [];

  const matchedCommands = rank(
    commands,
    q,
    (command) => `${command.label} ${command.description} ${command.keywords.join(" ")}`,
    8,
  );
  if (matchedCommands.length) {
    sections.push({
      id: "commands",
      title: "Commands",
      rows: matchedCommands.map((command) => ({
        type: "command",
        key: command.id,
        command,
      })),
    });
  }

  const folders = rank(
    mailFolders.filter((folder) => folder.key !== "all"),
    q,
    (folder) => folder.label,
    PER_GROUP_CAP,
  );
  if (folders.length) {
    sections.push({
      id: "folders",
      title: "Folders",
      rows: folders.map((folder) => ({
        type: "folder",
        key: `folder-${folder.key}`,
        folder: folder.key,
        label: folder.label,
      })),
    });
  }

  // Unique senders, keyed by address.
  const uniqueSenders = getUniqueSenders(emails);
  const senders = rank(uniqueSenders, q, (email) => `${email.from} ${email.email}`, PER_GROUP_CAP);
  if (senders.length) {
    sections.push({
      id: "senders",
      title: "Senders",
      rows: senders.map((email) => ({ type: "sender", key: `sender-${email.id}`, email })),
    });
  }

  const proofs = rank(
    emails,
    q,
    (email) => `${deriveProof(email)} ${email.subject} ${email.from}`,
    4,
  );
  if (proofs.length) {
    sections.push({
      id: "proofs",
      title: "Proofs",
      rows: proofs.map((email) => ({
        type: "proof",
        key: `proof-${email.id}`,
        email,
        proof: deriveProof(email),
      })),
    });
  }

  const settings = rank(
    SETTINGS_SHORTCUTS,
    q,
    (setting) => `${setting.label} ${setting.keywords.join(" ")}`,
    PER_GROUP_CAP,
  );
  if (settings.length) {
    sections.push({
      id: "settings",
      title: "Settings",
      rows: settings.map((setting) => ({
        type: "setting",
        key: `setting-${setting.id}`,
        setting,
      })),
    });
  }

  return sections;
}

/** Flatten sections to the rows that keyboard navigation can land on. */
export function selectableRows(sections: PaletteSection[]): PaletteRow[] {
  return sections
    .flatMap((section) => section.rows)
    .filter((row) => !(row.type === "command" && !row.command.availability.enabled));
}
