import {
  Archive,
  BadgeCheck,
  Ban,
  CalendarDays,
  Coins,
  Inbox,
  Pencil,
  Radio,
  ReceiptText,
  RotateCcw,
  Send,
  Settings,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { Email, MailFolder } from "@/components/mail/data";

export type CommandId =
  | "compose"
  | "go-inbox"
  | "go-starred"
  | "go-sent"
  | "open-calendar"
  | "open-settings"
  | "open-shortcuts"
  | "archive-thread"
  | "approve-sender"
  | "block-sender"
  | "quote-postage"
  | "inspect-proof"
  | "settle-delivery"
  | "refund-postage"
  | "relay-diagnostics"
  | "open-proof-inspector";

export type CommandGroupId = "message" | "protocol" | "delivery" | "navigation" | "app";

export const COMMAND_GROUP_LABEL: Record<CommandGroupId, string> = {
  message: "Message",
  protocol: "Sender & proof",
  delivery: "Delivery",
  navigation: "Navigation",
  app: "App",
};

/** The slice of app state a command reasons about. */
export type CommandContext = {
  email: Email | null;
  folder: MailFolder;
};

/** Either runnable, or blocked with a one-line explanation shown in the palette. */
export type CommandAvailability = { enabled: true } | { enabled: false; help: string };

export type CommandConfirm = {
  title: string;
  body: string;
  confirmLabel: string;
};

export type CommandDescriptor = {
  id: CommandId;
  group: CommandGroupId;
  label: string;
  description: string;
  icon: LucideIcon;
  hint?: string;
  /** Dangerous commands require a second confirmation step before running. */
  dangerous?: boolean;
  confirm?: CommandConfirm;
  /** Extra terms for fuzzy matching beyond the label. */
  keywords: string[];
  availability: (ctx: CommandContext) => CommandAvailability;
};

const OK: CommandAvailability = { enabled: true };
const no = (help: string): CommandAvailability => ({ enabled: false, help });

/** Postage refunds make sense for paid requests or senders you've turned away. */
function canRefund(email: Email): boolean {
  if (email.folder === "requests" || email.folder === "spam") return true;
  return (email.labels ?? []).some((label) => /paid|postage/i.test(label));
}

/** Delivery can be settled for in-flight / receipt-bearing messages. */
const SETTLE_FOLDERS = new Set<MailFolder>(["pending", "outbox", "receipts"]);

export const COMMANDS: CommandDescriptor[] = [
  // -- Sender & proof -------------------------------------------------------
  {
    id: "approve-sender",
    group: "protocol",
    label: "Approve sender",
    description: "Trust this sender so future mail skips review.",
    icon: BadgeCheck,
    keywords: ["allow", "trust", "whitelist", "contact"],
    availability: (ctx) => {
      if (!ctx.email) return no("Select a message to approve its sender.");
      if (ctx.email.senderPolicy === "allow") return no("This sender is already approved.");
      return OK;
    },
  },
  {
    id: "block-sender",
    group: "protocol",
    label: "Block sender",
    description: "Reject this sender and stop their mail.",
    icon: Ban,
    dangerous: true,
    confirm: {
      title: "Block this sender?",
      body: "Their messages move to Spam and any postage is marked for refund.",
      confirmLabel: "Block sender",
    },
    keywords: ["reject", "deny", "spam", "blocklist"],
    availability: (ctx) => {
      if (!ctx.email) return no("Select a message to block its sender.");
      if (ctx.email.senderPolicy === "block") return no("This sender is already blocked.");
      return OK;
    },
  },
  {
    id: "quote-postage",
    group: "protocol",
    label: "Quote postage",
    description: "Show the postage this sender must attach.",
    icon: Coins,
    keywords: ["price", "fee", "cost", "stamp", "xlm"],
    availability: (ctx) => (ctx.email ? OK : no("Select a message to quote its postage.")),
  },
  {
    id: "inspect-proof",
    group: "protocol",
    label: "Inspect proof",
    description: "Copy the message's delivery proof hash.",
    icon: ShieldCheck,
    keywords: ["hash", "verify", "memo", "attestation", "soroban"],
    availability: (ctx) => (ctx.email ? OK : no("Select a message to inspect its proof.")),
  },
  // -- Delivery -------------------------------------------------------------
  {
    id: "settle-delivery",
    group: "delivery",
    label: "Settle delivery",
    description: "Record an on-chain delivery receipt.",
    icon: ReceiptText,
    keywords: ["receipt", "confirm", "finalize", "anchor"],
    availability: (ctx) => {
      if (!ctx.email) return no("Select a delivery message to settle.");
      if (!SETTLE_FOLDERS.has(ctx.email.folder)) {
        return no("Settling applies to pending, outbox, or receipt messages.");
      }
      return OK;
    },
  },
  {
    id: "refund-postage",
    group: "delivery",
    label: "Refund postage",
    description: "Return the sender's postage payment.",
    icon: RotateCcw,
    dangerous: true,
    confirm: {
      title: "Refund this postage?",
      body: "The sender's payment is returned and the message is quarantined.",
      confirmLabel: "Refund postage",
    },
    keywords: ["return", "reverse", "money", "payment"],
    availability: (ctx) => {
      if (!ctx.email) return no("Select a paid message to refund.");
      if (!canRefund(ctx.email)) {
        return no("Refunds apply to paid requests or blocked senders.");
      }
      return OK;
    },
  },
  {
    id: "relay-diagnostics",
    group: "delivery",
    label: "Open relay diagnostics",
    description: "Check relay node health and latency.",
    icon: Radio,
    keywords: ["network", "node", "status", "latency", "health"],
    availability: () => OK,
  },
  // -- Message --------------------------------------------------------------
  {
    id: "archive-thread",
    group: "message",
    label: "Archive thread",
    description: "Move this conversation to the archive.",
    icon: Archive,
    hint: "E",
    keywords: ["done", "file", "remove"],
    availability: (ctx) => {
      if (!ctx.email) return no("Select a message to archive.");
      if (ctx.email.folder === "archive") return no("This thread is already archived.");
      if (ctx.email.folder === "trash") return no("This thread is in the trash.");
      return OK;
    },
  },
  // -- Navigation / app -----------------------------------------------------
  {
    id: "compose",
    group: "app",
    label: "Compose new email",
    description: "Start a new message.",
    icon: Pencil,
    hint: "⌘N",
    keywords: ["write", "new", "draft"],
    availability: () => OK,
  },
  {
    id: "open-calendar",
    group: "app",
    label: "Open calendar",
    description: "Review scheduled events and create new ones.",
    icon: CalendarDays,
    hint: "C",
    keywords: ["events", "schedule", "meeting", "planner"],
    availability: () => OK,
  },
  {
    id: "go-inbox",
    group: "navigation",
    label: "Go to Inbox",
    description: "Open the inbox folder.",
    icon: Inbox,
    hint: "G I",
    keywords: ["home", "mail"],
    availability: () => OK,
  },
  {
    id: "go-starred",
    group: "navigation",
    label: "Go to Starred",
    description: "Open starred messages.",
    icon: Star,
    hint: "G S",
    keywords: ["flagged", "important"],
    availability: () => OK,
  },
  {
    id: "go-sent",
    group: "navigation",
    label: "Go to Sent",
    description: "Open sent messages.",
    icon: Send,
    hint: "G T",
    keywords: ["outbox"],
    availability: () => OK,
  },
  {
    id: "open-settings",
    group: "app",
    label: "Open settings",
    description: "Adjust inbox, policy, and appearance.",
    icon: Settings,
    hint: ",",
    keywords: ["preferences", "config", "options"],
    availability: () => OK,
  },
  {
    id: "open-shortcuts",
    group: "app",
    label: "Open keyboard shortcuts",
    description: "Browse the searchable shortcut reference.",
    icon: Settings,
    hint: "?",
    keywords: ["help", "keyboard", "overlay", "cheatsheet"],
    availability: () => OK,
  },
  {
    id: "open-proof-inspector",
    group: "app",
    label: "Open Proof Inspector",
    description: "Search and inspect cryptographic proofs for mail delivery.",
    icon: ShieldCheck,
    hint: "I",
    keywords: ["proof", "inspector", "hash", "diagnostic", "stellar", "verification"],
    availability: () => OK,
  },
];

export type ResolvedCommand = Omit<CommandDescriptor, "availability"> & {
  availability: CommandAvailability;
};

/**
 * Resolve every command against the current context, attaching live
 * availability. Pure and cheap so the palette can recompute on each render /
 * selection change without measurable cost on fixtures or future API data.
 */
export function buildCommands(ctx: CommandContext): ResolvedCommand[] {
  return COMMANDS.map((command) => ({ ...command, availability: command.availability(ctx) }));
}
