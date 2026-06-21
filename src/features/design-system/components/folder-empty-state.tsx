import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ActionButton } from "./action-button";
import { motionPresets } from "@/lib/motion-presets";
import {
  FOLDER_ILLUSTRATION,
  type EmptyFolderType,
} from "./empty-state-illustrations";

// ─── Copy & CTA config ──────────────────────────────────────────────────

interface FolderEmptyCopy {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  secondary?: string;
}

const FOLDER_COPY: Record<EmptyFolderType, FolderEmptyCopy> = {
  inbox: {
    title: "Your inbox is quiet",
    description:
      "No new conversations yet. Messages from trusted and verified senders will appear here automatically.",
    actionLabel: "Compose a message",
    secondary: "Or wait for incoming mail — new messages land here in real time.",
  },
  requests: {
    title: "All caught up",
    description:
      "No pending sender requests. Your inbox policy is working perfectly — unknown senders will queue here for your review.",
    secondary: "When a new sender pays postage, their request will appear in this folder.",
  },
  proofs: {
    title: "No proofs to inspect",
    description:
      "Delivery and payment proofs are generated automatically when you send or receive mail. They will appear here once settled.",
    actionLabel: "Open proof inspector",
    secondary: "You can also search for a specific transaction hash on the Stellar network.",
  },
  receipts: {
    title: "No receipts yet",
    description:
      "Delivery receipts are created when a message is opened and the read proof is settled on-chain.",
    secondary: "Receipts remain accessible here for audit and dispute resolution.",
  },
  archive: {
    title: "Archive is empty",
    description:
      "Messages you archive will be stored here. Archiving removes them from your inbox but keeps them accessible.",
    actionLabel: "Go to inbox",
    secondary: "You can also set auto-archive rules in Settings.",
  },
  spam: {
    title: "Spam folder is clean",
    description:
      "No unwanted messages detected. Your sender policy and relay filters are working as expected.",
    secondary: "Blocked senders and refunded postage messages appear here.",
  },
  search: {
    title: "No results found",
    description:
      "Try adjusting your search query or filters. Searches cover sender name, subject, message body, and proof hashes.",
    actionLabel: "Clear filters",
    secondary: "You can also browse your folders directly from the sidebar.",
  },
  priority: {
    title: "No priority messages",
    description:
      "Important and time-sensitive messages will appear here. Priority is determined by sender trust, urgency signals, and your preferences.",
    secondary: "Messages with high trust scores or flagged senders are promoted to this folder.",
  },
  snoozed: {
    title: "Nothing snoozed",
    description:
      "Messages you snooze will return to your inbox at the time you choose. Snoozed messages are hidden until then.",
    actionLabel: "Go to inbox",
    secondary: "You can snooze any message by clicking the clock icon.",
  },
  verified: {
    title: "No verified senders yet",
    description:
      "Senders you've verified through cryptographic proof or manual approval will appear here. This folder helps you keep track of trusted contacts.",
    secondary: "Verify a sender by reviewing their request in the Requests folder.",
  },
  encrypted: {
    title: "No encrypted messages",
    description:
      "End-to-end encrypted messages are stored here. They are decrypted locally and never visible to relay operators.",
    secondary: "Encrypted messages are automatically routed to this folder when received.",
  },
  starred: {
    title: "No starred messages",
    description:
      "Starred messages give you quick access to important conversations. Star a message by clicking the star icon.",
    actionLabel: "Go to inbox",
    secondary: "Starred messages remain visible across folder changes.",
  },
  sent: {
    title: "No sent messages",
    description:
      "Messages you send will appear here. Sent messages include delivery receipts and on-chain proof status.",
    actionLabel: "Compose a message",
    secondary: "Outgoing messages are also tracked in the Outbox until confirmed.",
  },
  outbox: {
    title: "Outbox is empty",
    description:
      "Messages waiting to be sent appear here. Once confirmed by the relay, they move to your Sent folder.",
    secondary: "If a message is stuck, check your relay connection or try again.",
  },
  drafts: {
    title: "No drafts",
    description:
      "Drafts are saved automatically as you compose. Come back here to pick up where you left off.",
    actionLabel: "Compose a message",
    secondary: "Drafts are stored locally and synced when you're online.",
  },
  scheduled: {
    title: "No scheduled messages",
    description:
      "Messages scheduled for future delivery appear here. You can schedule a message from the compose window.",
    secondary: "Scheduled messages are sent automatically at the chosen time.",
  },
  trash: {
    title: "Trash is empty",
    description:
      "Deleted messages are moved here and can be recovered for a short time before being permanently removed.",
    secondary: "Empty the trash periodically to free up storage.",
  },
  all: {
    title: "No messages yet",
    description:
      "All your messages across every folder will appear here. Start by composing or receiving your first message.",
    actionLabel: "Compose a message",
    secondary: "Once you have messages, this view shows everything in one place.",
  },
  generic: {
    title: "This folder is empty",
    description:
      "There are no messages in this folder yet. Messages will appear here when they match the folder's rules.",
    secondary: "Try checking other folders or adjusting your filters.",
  },
};

// ─── MailFolder → EmptyFolderType mapper ────────────────────────────────

const MAIL_FOLDER_TO_EMPTY: Record<string, EmptyFolderType> = {
  inbox: "inbox",
  requests: "requests",
  pending: "proofs",
  receipts: "receipts",
  archive: "archive",
  spam: "spam",
  priority: "priority",
  snoozed: "snoozed",
  verified: "verified",
  encrypted: "encrypted",
  starred: "starred",
  sent: "sent",
  outbox: "outbox",
  drafts: "drafts",
  scheduled: "scheduled",
  trash: "trash",
  all: "all",
};

export function mailFolderToEmptyType(folder: string): EmptyFolderType {
  return MAIL_FOLDER_TO_EMPTY[folder] ?? "generic";
}

// ─── Component ──────────────────────────────────────────────────────────

interface FolderEmptyStateProps {
  folder: EmptyFolderType;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
  onAction?: () => void;
  searchQuery?: string;
}

export function FolderEmptyState({
  folder,
  title,
  description,
  action,
  className,
  compact = false,
  onAction,
  searchQuery,
}: FolderEmptyStateProps) {
  const copy = FOLDER_COPY[folder];
  const Illustration = FOLDER_ILLUSTRATION[folder];
  const showActionLabel = copy.actionLabel && !action;

  return (
    <motion.div
      {...motionPresets.entrance.scaleIn(0.96)}
      className={cn(
        "mx-auto flex max-w-xs flex-col items-center text-center",
        compact ? "gap-4 py-8" : "gap-6 py-12",
        className,
      )}
    >
      <div className="relative">
        <div
          className={cn(
            "absolute inset-0 rounded-full opacity-0",
            "motion-safe:animate-[pulse_4s_ease-in-out_infinite]",
            "motion-reduce:hidden",
          )}
          style={{
            background: "radial-gradient(circle, oklch(1 0 0 / 0.06) 0%, transparent 70%)",
            filter: "blur(12px)",
            transform: "scale(1.4)",
          }}
          aria-hidden="true"
        />
        <div
          className={cn(
            "motion-safe:animate-[float_6s_ease-in-out_infinite]",
            "motion-reduce:animate-none",
          )}
        >
          <Illustration
            size={compact ? 80 : 100}
            className="text-muted-foreground/60"
          />
        </div>
      </div>

      <h3 className="text-sm font-semibold text-foreground">{title ?? copy.title}</h3>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {description ?? copy.description}
      </p>

      {folder === "search" && searchQuery && (
        <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">Query:</span>
          <span className="max-w-[180px] truncate text-[10px] font-mono text-foreground/70">
            "{searchQuery}"
          </span>
        </div>
      )}

      {action}
      {showActionLabel && (
        <ActionButton size="sm" onClick={onAction}>
          {copy.actionLabel}
        </ActionButton>
      )}

      {copy.secondary && (
        <p className="text-[10px] leading-relaxed text-muted-foreground/60">
          {copy.secondary}
        </p>
      )}
    </motion.div>
  );
}

export type { FolderEmptyStateProps, FolderEmptyCopy, EmptyFolderType };