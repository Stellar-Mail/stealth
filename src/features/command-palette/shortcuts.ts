import type { CommandId } from "./types";

export type ShortcutActionId =
  | "open-palette"
  | "open-shortcuts"
  | "compose"
  | "archive-thread"
  | "snooze-thread"
  | "approve-sender"
  | "block-sender"
  | "open-calendar"
  | "open-settings"
  | "open-proof-inspector";

export type ShortcutDefinition = {
  id: ShortcutActionId;
  label: string;
  description: string;
  keys: string[];
  keywords: string[];
  commandId?: CommandId;
  conflict?: string;
};

type ShortcutTargetLike = {
  tagName?: string | null;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  parentElement?: ShortcutTargetLike | null;
};

type ShortcutEventLike = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
};

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: "compose",
    commandId: "compose",
    label: "Compose",
    description: "Start a new message from anywhere in the mailbox.",
    keys: ["Ctrl/Cmd", "N"],
    keywords: ["new", "write", "draft", "message"],
  },
  {
    id: "open-palette",
    label: "Search",
    description: "Open the command palette to search commands, folders, senders, and proofs.",
    keys: ["Ctrl/Cmd", "K"],
    keywords: ["palette", "find", "search", "commands"],
    conflict: "Uses the palette instead of remapping browser find.",
  },
  {
    id: "archive-thread",
    commandId: "archive-thread",
    label: "Archive",
    description: "Move the selected conversation into Archive.",
    keys: ["E"],
    keywords: ["done", "thread", "file"],
  },
  {
    id: "snooze-thread",
    label: "Snooze",
    description: "Snooze the selected conversation until tomorrow morning.",
    keys: ["Z"],
    keywords: ["later", "remind", "pause"],
  },
  {
    id: "approve-sender",
    commandId: "approve-sender",
    label: "Approve sender",
    description: "Trust the selected sender and move future mail into your inbox.",
    keys: ["A"],
    keywords: ["allow", "trust", "sender"],
  },
  {
    id: "block-sender",
    commandId: "block-sender",
    label: "Block sender",
    description: "Block the selected sender and move the message to Spam.",
    keys: ["B"],
    keywords: ["spam", "deny", "refund"],
  },
  {
    id: "open-calendar",
    commandId: "open-calendar",
    label: "Calendar",
    description: "Open the calendar workspace for scheduling and event review.",
    keys: ["C"],
    keywords: ["events", "schedule", "meeting"],
  },
  {
    id: "open-settings",
    commandId: "open-settings",
    label: "Settings",
    description: "Open inbox, policy, and appearance settings.",
    keys: [","],
    keywords: ["preferences", "config", "options"],
  },
  {
    id: "open-shortcuts",
    commandId: "open-shortcuts",
    label: "Shortcut help",
    description: "Open the searchable shortcut overlay.",
    keys: ["?"],
    keywords: ["help", "keyboard", "overlay", "shortcuts"],
    conflict: "Disabled while typing in text fields so question marks still work normally.",
  },
  {
    id: "open-proof-inspector",
    commandId: "open-proof-inspector",
    label: "Proof Inspector",
    description: "Open the cryptographic proof inspector.",
    keys: ["I"],
    keywords: ["proof", "inspect", "ledger", "stellar"],
  },
];

export const SHORTCUTS_BY_COMMAND = new Map(
  SHORTCUT_DEFINITIONS.filter((shortcut) => shortcut.commandId).map((shortcut) => [
    shortcut.commandId!,
    shortcut,
  ]),
);

export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  let node = target as ShortcutTargetLike | null | undefined;
  while (node) {
    const tagName = node.tagName?.toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
    if (node.isContentEditable) return true;
    const role = node.getAttribute?.("role");
    if (role === "textbox") return true;
    node = node.parentElement;
  }
  return false;
}

export function getShortcutAction(event: ShortcutEventLike): ShortcutActionId | null {
  if (isEditableTarget(event.target) || event.altKey) return null;

  const key = event.key.toLowerCase();
  const hasCommandModifier = !!event.metaKey || !!event.ctrlKey;

  // Suppress all global shortcuts if any dialog or modal is open, except Ctrl/Cmd+K.
  if (typeof document !== "undefined") {
    const activeDialog = document.querySelector(
      '[role="dialog"], [aria-modal="true"], [data-state="open"]',
    );
    if (activeDialog) {
      if (hasCommandModifier && key === "k") return "open-palette";
      return null;
    }
  }

  if (hasCommandModifier && key === "k") return "open-palette";
  if (hasCommandModifier && key === "n") return "compose";
  if (!hasCommandModifier && key === "e") return "archive-thread";
  if (!hasCommandModifier && key === "z") return "snooze-thread";
  if (!hasCommandModifier && key === "a") return "approve-sender";
  if (!hasCommandModifier && key === "b") return "block-sender";
  if (!hasCommandModifier && key === "c") return "open-calendar";
  if (!hasCommandModifier && event.key === ",") return "open-settings";
  if (!hasCommandModifier && event.key === "?") return "open-shortcuts";
  if (!hasCommandModifier && key === "i") return "open-proof-inspector";

  return null;
}
