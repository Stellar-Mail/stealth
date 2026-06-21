import type { SVGProps } from "react";

// ─── Lightweight SVG illustration primitives ──────────────────────────────
// Zero bitmap assets, zero external dependencies. Each illustration is a
// simple branded SVG drawn with the same dark‑theme palette used by the app.
// Motion wrappers are applied in <FolderEmptyState>, not here.

type IlloProps = SVGProps<SVGSVGElement> & { size?: number };

function IlloWrap({ children, size = 120, ...rest }: IlloProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ─── Inbox ──────────────────────────────────────────────────────────── */
export function InboxIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <rect x="12" y="40" width="96" height="52" rx="8" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <path d="M24 40 60 72 96 40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="36" y="24" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="1.2" fill="oklch(1 0 0 / 0.04)" />
      <path d="M36 28 60 50 84 28" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5" />
      <circle cx="60" cy="66" r="3" fill="currentColor" opacity="0.15" />
      <circle cx="48" cy="70" r="1.5" fill="currentColor" opacity="0.1" />
      <circle cx="72" cy="70" r="1.5" fill="currentColor" opacity="0.1" />
    </IlloWrap>
  );
}

/* ─── Requests ───────────────────────────────────────────────────────── */
export function RequestsIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <circle cx="60" cy="40" r="14" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <path d="M30 92c0-16.55 13.45-30 30-30s30 13.45 30 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M72 36c0 8-6 14-12 17M72 36c0-4 6-8 12-8v18c-6 0-12-3-12-10Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="oklch(1 0 0 / 0.04)" />
      <path d="m68 32 3 3 5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="78" r="2.5" fill="currentColor" opacity="0.12" />
      <circle cx="50" cy="84" r="1.5" fill="currentColor" opacity="0.08" />
    </IlloWrap>
  );
}

/* ─── Proofs / Pending ──────────────────────────────────────────────── */
export function ProofsIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <rect x="28" y="16" width="64" height="76" rx="6" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <rect x="38" y="30" width="44" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      <rect x="38" y="40" width="36" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="38" y="50" width="40" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="38" y="60" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.1" />
      <circle cx="84" cy="82" r="16" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
      <circle cx="84" cy="82" r="10" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.2" />
      <path d="M84 74v8l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <circle cx="60" cy="88" r="2" fill="currentColor" opacity="0.1" />
    </IlloWrap>
  );
}

/* ─── Receipts ───────────────────────────────────────────────────────── */
export function ReceiptsIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <path d="M36 18h48a4 4 0 0 1 4 4v76a4 4 0 0 1-4 4H36a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <rect x="44" y="32" width="32" height="2.5" rx="1.25" fill="currentColor" opacity="0.2" />
      <rect x="44" y="42" width="26" height="2.5" rx="1.25" fill="currentColor" opacity="0.15" />
      <rect x="44" y="52" width="30" height="2.5" rx="1.25" fill="currentColor" opacity="0.15" />
      <rect x="44" y="62" width="20" height="2.5" rx="1.25" fill="currentColor" opacity="0.1" />
      <circle cx="60" cy="82" r="12" stroke="currentColor" strokeWidth="1.2" fill="oklch(1 0 0 / 0.04)" />
      <path d="m54 82 4 4 8-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="44" cy="18" r="4" fill="oklch(0.18 0.005 270)" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="60" cy="18" r="4" fill="oklch(0.18 0.005 270)" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="76" cy="18" r="4" fill="oklch(0.18 0.005 270)" stroke="currentColor" strokeWidth="1.2" />
    </IlloWrap>
  );
}

/* ─── Archive ────────────────────────────────────────────────────────── */
export function ArchiveIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <path d="M18 42h84a4 4 0 0 1 4 4v40a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V46a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <path d="M18 42 28 24h24l5 18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="oklch(1 0 0 / 0.04)" />
      <path d="M60 56v24m-8-10 8 10 8-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="76" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="50" cy="74" r="1.5" fill="currentColor" opacity="0.08" />
    </IlloWrap>
  );
}

/* ─── Spam ───────────────────────────────────────────────────────────── */
export function SpamIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <path d="M60 18c14 0 28 6 34 18-2 22-10 40-34 56C36 76 28 58 26 36 32 24 46 18 60 18Z" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <rect x="57" y="40" width="6" height="20" rx="3" fill="currentColor" opacity="0.6" />
      <circle cx="60" cy="68" r="4" fill="currentColor" opacity="0.6" />
      <path d="M32 28 88 84" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
      <circle cx="60" cy="80" r="2" fill="currentColor" opacity="0.1" />
      <circle cx="46" cy="58" r="1.5" fill="currentColor" opacity="0.08" />
    </IlloWrap>
  );
}

/* ─── Search ─────────────────────────────────────────────────────────── */
export function SearchIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <circle cx="52" cy="48" r="20" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <path d="m66 62 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M88 34h8M88 34l-3-4M88 34l-3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M82 60h14M82 60l-2-3M82 60l-2 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
      <path d="M86 76h10M86 76l-2-3M86 76l-2 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
      <circle cx="52" cy="48" r="2.5" fill="currentColor" opacity="0.12" />
    </IlloWrap>
  );
}

/* ─── Priority ───────────────────────────────────────────────────────── */
export function PriorityIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <path d="M60 16l8.5 17.2 19 2.8-13.8 13.4 3.3 19L60 60.5l-17 8.9 3.3-19L32.5 36l19-2.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="oklch(1 0 0 / 0.03)" />
      <path d="M56 44l-4 16h10l-2 16 12-20H62l4-12Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="oklch(1 0 0 / 0.06)" opacity="0.6" />
      <circle cx="60" cy="72" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="50" cy="68" r="1.5" fill="currentColor" opacity="0.08" />
    </IlloWrap>
  );
}

/* ─── Snoozed ────────────────────────────────────────────────────────── */
export function SnoozedIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <circle cx="60" cy="50" r="22" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <path d="M60 50v-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M60 50 70 56" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path d="M80 28c-8 0-14 6-14 14s6 14 14 14c-4-4-6-9-6-14s2-10 6-14Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="oklch(1 0 0 / 0.04)" opacity="0.5" />
      <text x="44" y="88" fontSize="10" fontWeight="bold" fill="currentColor" opacity="0.2" fontFamily="monospace">Z</text>
      <text x="52" y="96" fontSize="8" fontWeight="bold" fill="currentColor" opacity="0.15" fontFamily="monospace">z</text>
      <text x="58" y="102" fontSize="6" fontWeight="bold" fill="currentColor" opacity="0.1" fontFamily="monospace">z</text>
      <circle cx="60" cy="80" r="2" fill="currentColor" opacity="0.1" />
    </IlloWrap>
  );
}

/* ─── Verified ───────────────────────────────────────────────────────── */
export function VerifiedIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <path d="M60 18 90 36v48L60 102 30 84V36Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="oklch(1 0 0 / 0.03)" />
      <circle cx="60" cy="60" r="18" stroke="currentColor" strokeWidth="1.2" fill="oklch(1 0 0 / 0.04)" />
      <path d="m50 60 6 6 14-14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="88" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="48" cy="80" r="1.5" fill="currentColor" opacity="0.08" />
    </IlloWrap>
  );
}

/* ─── Encrypted ──────────────────────────────────────────────────────── */
export function EncryptedIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <rect x="36" y="52" width="48" height="40" rx="6" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <path d="M44 52V38c0-8.8 7.2-16 16-16s16 7.2 16 16v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="60" cy="72" r="6" stroke="currentColor" strokeWidth="1.2" fill="oklch(1 0 0 / 0.04)" />
      <rect x="58" y="72" width="4" height="8" rx="2" fill="currentColor" opacity="0.4" />
      <circle cx="60" cy="88" r="2" fill="currentColor" opacity="0.1" />
      <circle cx="50" cy="84" r="1.5" fill="currentColor" opacity="0.08" />
    </IlloWrap>
  );
}

/* ─── Starred ────────────────────────────────────────────────────────── */
export function StarredIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <path d="M60 20l7.5 15.2 16.8 2.4-12.2 11.8 2.9 16.8L60 57.5l-15 7.7 2.9-16.8L35.7 37.6l16.8-2.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="oklch(1 0 0 / 0.03)" />
      <path d="M88 28h4M90 26v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <path d="M24 68h3M25.5 66.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      <path d="M82 80h3M83.5 78.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.25" />
      <circle cx="60" cy="76" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="48" cy="70" r="1.5" fill="currentColor" opacity="0.08" />
    </IlloWrap>
  );
}

/* ─── Sent ───────────────────────────────────────────────────────────── */
export function SentIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <path d="M20 60h60M60 36l24 24-24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="80" cy="80" r="14" stroke="currentColor" strokeWidth="1.2" fill="oklch(1 0 0 / 0.04)" />
      <path d="m74 80 4 4 8-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="88" r="2" fill="currentColor" opacity="0.1" />
      <circle cx="50" cy="84" r="1.5" fill="currentColor" opacity="0.08" />
    </IlloWrap>
  );
}

/* ─── Outbox ─────────────────────────────────────────────────────────── */
export function OutboxIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <rect x="16" y="50" width="88" height="44" rx="8" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <path d="M60 18v32m-10-8 10-10 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="40" y="28" width="40" height="28" rx="4" stroke="currentColor" strokeWidth="1.2" fill="oklch(1 0 0 / 0.04)" opacity="0.5" />
      <path d="M40 32 60 50 80 32" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.3" />
      <circle cx="60" cy="78" r="3" fill="currentColor" opacity="0.2" />
      <circle cx="50" cy="82" r="1.5" fill="currentColor" opacity="0.08" />
    </IlloWrap>
  );
}

/* ─── Drafts ─────────────────────────────────────────────────────────── */
export function DraftsIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <rect x="30" y="20" width="52" height="64" rx="6" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <rect x="40" y="34" width="34" height="2.5" rx="1.25" fill="currentColor" opacity="0.2" />
      <rect x="40" y="42" width="28" height="2.5" rx="1.25" fill="currentColor" opacity="0.15" />
      <rect x="40" y="50" width="30" height="2.5" rx="1.25" fill="currentColor" opacity="0.15" />
      <rect x="40" y="58" width="18" height="2.5" rx="1.25" fill="currentColor" opacity="0.1" />
      <path d="M72 18 96 42l-4 4-24-24 4-4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="oklch(1 0 0 / 0.04)" />
      <path d="M72 18 96 42" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M68 22 72 18l4 4-4 4Z" fill="currentColor" opacity="0.3" />
      <circle cx="60" cy="80" r="2" fill="currentColor" opacity="0.1" />
    </IlloWrap>
  );
}

/* ─── Scheduled ──────────────────────────────────────────────────────── */
export function ScheduledIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <rect x="28" y="30" width="64" height="64" rx="8" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <rect x="28" y="30" width="64" height="18" rx="8" stroke="currentColor" strokeWidth="1.2" fill="oklch(1 0 0 / 0.04)" />
      <rect x="36" y="22" width="6" height="12" rx="3" fill="currentColor" opacity="0.2" />
      <rect x="78" y="22" width="6" height="12" rx="3" fill="currentColor" opacity="0.2" />
      <circle cx="60" cy="64" r="14" stroke="currentColor" strokeWidth="1.2" fill="oklch(1 0 0 / 0.04)" />
      <path d="M60 58v6l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="88" r="2" fill="currentColor" opacity="0.1" />
    </IlloWrap>
  );
}

/* ─── Trash ──────────────────────────────────────────────────────────── */
export function TrashIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <path d="M34 44h52l-6 56H40l-6-56Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="oklch(1 0 0 / 0.03)" />
      <path d="M26 36h68" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M48 28V22a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="44" y="52" width="4" height="28" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="58" y="52" width="4" height="28" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="72" y="52" width="4" height="28" rx="2" fill="currentColor" opacity="0.15" />
      <circle cx="60" cy="88" r="2" fill="currentColor" opacity="0.1" />
    </IlloWrap>
  );
}

/* ─── All Mail ───────────────────────────────────────────────────────── */
export function AllMailIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <rect x="22" y="22" width="56" height="40" rx="4" stroke="currentColor" strokeWidth="1.2" fill="oklch(1 0 0 / 0.02)" opacity="0.3" />
      <path d="M22 26 50 48 78 26" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.2" />
      <rect x="32" y="36" width="56" height="40" rx="4" stroke="currentColor" strokeWidth="1.2" fill="oklch(1 0 0 / 0.03)" opacity="0.5" />
      <path d="M32 40 60 62 88 40" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.3" />
      <rect x="42" y="50" width="56" height="40" rx="4" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <path d="M42 54 70 76 98 54" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5" />
      <circle cx="70" cy="84" r="2" fill="currentColor" opacity="0.12" />
      <circle cx="60" cy="80" r="1.5" fill="currentColor" opacity="0.08" />
    </IlloWrap>
  );
}

/* ─── Generic fallback ──────────────────────────────────────────────── */
export function GenericFolderIllo(props: IlloProps) {
  return (
    <IlloWrap {...props}>
      <path d="M18 42h84a4 4 0 0 1 4 4v40a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V46a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="1.5" fill="oklch(1 0 0 / 0.03)" />
      <path d="M18 42 28 24h24l5 18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="oklch(1 0 0 / 0.04)" />
      <circle cx="60" cy="66" r="2" fill="currentColor" opacity="0.12" />
    </IlloWrap>
  );
}

export type EmptyFolderType = "inbox" | "requests" | "proofs" | "receipts" | "archive" | "spam" | "search" | "priority" | "snoozed" | "verified" | "encrypted" | "starred" | "sent" | "outbox" | "drafts" | "scheduled" | "trash" | "all" | "generic";

export const FOLDER_ILLUSTRATION: Record<EmptyFolderType, (props: IlloProps) => JSX.Element> = {
  inbox: InboxIllo,
  requests: RequestsIllo,
  proofs: ProofsIllo,
  receipts: ReceiptsIllo,
  archive: ArchiveIllo,
  spam: SpamIllo,
  search: SearchIllo,
  priority: PriorityIllo,
  snoozed: SnoozedIllo,
  verified: VerifiedIllo,
  encrypted: EncryptedIllo,
  starred: StarredIllo,
  sent: SentIllo,
  outbox: OutboxIllo,
  drafts: DraftsIllo,
  scheduled: ScheduledIllo,
  trash: TrashIllo,
  all: AllMailIllo,
  generic: GenericFolderIllo,
};