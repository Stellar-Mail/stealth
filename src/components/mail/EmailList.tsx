import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderInput } from "lucide-react";
import {
  applyMailFilters,
  getEmailsForFolder,
  getFolderLabel,
  type Email,
  type MailFilters,
  type MailFolder,
  type MailLocation,
} from "./data";
import { cn } from "@/lib/utils";
import { MobileMailCard } from "./MobileMailCard";
import { EmailTrustBadges } from "./EmailTrustBadges";
import { SenderAvatar } from "./SenderAvatar";
import { DROP_TARGET_FOLDERS, getDropRejectionReason } from "./useDragDrop";
import { getTrustStates } from "./trust-state";
import { computeVirtualWindow } from "./virtual-window";

type FilterTab = "all" | "unread" | "flagged";

// BETA-074 (Issue #1981) — virtualized list windowing. Rows are estimated at a
// fixed height per breakpoint; only the visible window plus an overscan is
// rendered, so a 10k-message mailbox never materializes thousands of rows in
// the DOM. Estimates are conservative (taller than real rows) so content is
// never clipped; overscan covers the gap.
const DESKTOP_ROW_HEIGHT = 68;
const MOBILE_ROW_HEIGHT = 104;
const VERIFIED_PROFILE_EFFECTS = ["lunar", "ember", "tide"] as const;

function getVerifiedProfileEffect(email: Email) {
  const fingerprint = `${email.id}:${email.email}`;
  const hash = [...fingerprint].reduce((value, character) => value + character.charCodeAt(0), 0);
  return VERIFIED_PROFILE_EFFECTS[hash % VERIFIED_PROFILE_EFFECTS.length];
}

export function EmailList({
  emails,
  selectedId,
  onSelect,
  folder,
  filters,
  customFolder,
  showAvatars,
  useMobile,
  onArchive,
  onStar,
  onSnooze,
  onMove,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: {
  emails: Email[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  folder: MailFolder;
  filters: MailFilters;
  customFolder?: string | null;
  showAvatars: boolean;
  useMobile?: boolean;
  onArchive?: (email: Email) => void;
  onStar?: (email: Email) => void;
  onSnooze?: (email: Email) => void;
  onMove?: (emailIds: string[], target: MailLocation) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const folderLabel = customFolder ?? getFolderLabel(folder);
  const [movePicker, setMovePicker] = useState<{ emailIds: string[] } | null>(null);

  const folderEmails = useMemo(
    () =>
      customFolder
        ? emails.filter((email) =>
            email.labels?.some((label) => label.toLowerCase() === customFolder.toLowerCase()),
          )
        : getEmailsForFolder(emails, folder),
    [customFolder, emails, folder],
  );

  const filtered = useMemo(
    () =>
      applyMailFilters(folderEmails, filters).filter((e) => {
        if (activeTab === "unread") return e.unread;
        if (activeTab === "flagged") return e.starred;
        return true;
      }),
    [activeTab, filters, folderEmails],
  );

  const loadMoreRef = useRef<HTMLLIElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const onSelectRef = useRef(onSelect);

  // BETA-074 — scroll window tracking for virtualization.
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrollTop(node.scrollTop);
        setViewportHeight(node.clientHeight);
      });
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      ro?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const rowHeight = useMobile ? MOBILE_ROW_HEIGHT : DESKTOP_ROW_HEIGHT;
  const { start: virtualStart, end: virtualEnd } = computeVirtualWindow({
    count: filtered.length,
    scrollTop,
    viewportHeight,
    rowHeight,
  });
  const virtualItems = useMemo(
    () => filtered.slice(virtualStart, virtualEnd),
    [filtered, virtualEnd, virtualStart],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        if (movePicker) {
          setMovePicker(null);
          return;
        }
      }
      if (event.key === "m" || event.key === "M") {
        const focused = document.activeElement;
        if (focused && ["INPUT", "TEXTAREA", "SELECT"].includes((focused as HTMLElement).tagName))
          return;
        event.preventDefault();
        const ids = selectedId ? [selectedId] : [];
        if (ids.length > 0) setMovePicker({ emailIds: ids });
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (!hasMore || !onLoadMore || virtualItems.length === 0) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isLoadingMore) {
          onLoadMore();
        }
      },
      { root: listRef.current, rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore, virtualItems.length]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const row = target.closest<HTMLElement>("[data-email-id]");
      const id = row?.dataset.emailId;
      if (!id || !node.contains(row)) return;

      onSelectRef.current(id);
    };

    node.addEventListener("pointerdown", onPointerDown, true);
    return () => node.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return (
    <section className="mail-list-atmosphere relative m-3 flex h-[calc(100vh-3.5rem-1.5rem)] w-full flex-col overflow-hidden rounded-[8px] md:w-[328px] md:shrink-0 lg:w-[336px]">
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-3.5 py-3 backdrop-blur-sm">
        <div>
          <h2 className="text-[13px] font-semibold leading-5 tracking-normal text-foreground">
            {folderLabel}
          </h2>
          <p className="text-[11px] leading-4 text-muted-foreground">
            {filtered.length} conversations
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-[6px] border border-white/12 bg-gradient-to-b from-white/[0.08] to-white/[0.03] p-0.5 text-[10px] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]">
          {(["all", "unread", "flagged"] as const).map((t) => (
            <motion.button
              key={t}
              whileTap={{ scale: 0.96 }}
              onClick={() => setActiveTab(t)}
              className={cn(
                "relative rounded-[5px] px-2.5 py-1 font-medium transition capitalize",
                activeTab === t
                  ? "bg-gradient-to-b from-white/[0.12] to-white/[0.06] text-foreground shadow-[0_4px_12px_-6px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.16)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
              )}
            >
              {t}
            </motion.button>
          ))}
        </div>
      </div>

      <ul
        ref={listRef}
        role="list"
        aria-label={`${folderLabel} conversations`}
        tabIndex={0}
        className={cn(
          "scrollbar-thin relative z-10 flex-1 overflow-y-auto",
          useMobile ? "space-y-2 p-2" : "space-y-2 p-2.5 outline-none",
        )}
      >
        {filtered.length === 0 && (
          <li className="px-3 py-10 text-center text-xs text-muted-foreground">
            No conversations in {folderLabel.toLowerCase()} yet.
          </li>
        )}
        {virtualStart > 0 && <li aria-hidden="true" style={{ height: virtualStart * rowHeight }} />}
        {virtualItems.map((e, idx) => {
          const active = selectedId === e.id;
          const verifiedSender = getTrustStates(e).includes("verified");
          const verifiedEffect = verifiedSender ? getVerifiedProfileEffect(e) : null;

          if (useMobile) {
            return (
              <li key={e.id} className="px-1">
                <MobileMailCard
                  email={e}
                  selected={active}
                  onSelect={() => onSelect(e.id)}
                  onArchive={() => onArchive?.(e)}
                  onStar={() => onStar?.(e)}
                  onSnooze={() => onSnooze?.(e)}
                />
              </li>
            );
          }

          return (
            <li key={e.id}>
              <motion.button
                data-email-id={e.id}
                onClick={() => onSelect(e.id)}
                whileTap={{ scale: 0.99 }}
                transition={{ type: "spring", stiffness: 520, damping: 30 }}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "mail-preview-card group relative flex h-[60px] w-full items-center gap-3 overflow-hidden rounded-[14px] border px-3 py-2 text-left transition-[background,border-color,box-shadow] duration-200",
                  active
                    ? "mail-preview-card--active"
                    : "border-white/[0.09] bg-[oklch(0.3_0.006_270/0.42)]",
                  verifiedSender && "mail-preview-card--verified",
                )}
              >
                {verifiedSender && (
                  <span
                    aria-hidden="true"
                    className={`mail-preview-card__verified-effect mail-preview-card__verified-effect--${verifiedEffect}`}
                  />
                )}
                {showAvatars && (
                  <SenderAvatar email={e} size="md" unread={e.unread} className="z-[1]" />
                )}
                <div className="relative z-[1] min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "mail-preview-heading truncate text-[13.5px] font-semibold leading-5 text-foreground/88",
                          e.unread && "text-foreground/94",
                        )}
                      >
                        {e.from}
                      </span>
                      <EmailTrustBadges
                        email={e}
                        max={1}
                        size="sm"
                        showLabels={false}
                        className="shrink-0"
                      />
                    </div>
                    <span className="shrink-0 pt-0.5 text-[10.5px] font-medium leading-4 tabular-nums text-muted-foreground/85">
                      {e.time}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "mail-preview-subheading mt-0.5 truncate text-[12.25px] font-semibold leading-4 text-foreground/68",
                      e.unread && "text-foreground/78",
                    )}
                  >
                    {e.subject}
                  </div>
                </div>
              </motion.button>
            </li>
          );
        })}
        {virtualEnd < filtered.length && (
          <li aria-hidden="true" style={{ height: (filtered.length - virtualEnd) * rowHeight }} />
        )}
        {hasMore ? (
          <li ref={loadMoreRef} className="px-3 py-3">
            <button
              type="button"
              onClick={() => onLoadMore?.()}
              disabled={isLoadingMore}
              aria-busy={isLoadingMore}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground disabled:opacity-60"
            >
              {isLoadingMore ? "Loading more conversations" : "Load more conversations"}
            </button>
          </li>
        ) : null}
      </ul>

      {/* M-key folder picker overlay */}
      <AnimatePresence>
        {movePicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-[8px]"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Move to folder"
              className="w-56 rounded-xl border border-white/12 bg-[oklch(0.15_0.005_270)] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
                <FolderInput className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Move to folder</span>
                <span className="ml-auto text-[10px] text-muted-foreground">Esc to cancel</span>
              </div>
              <ul className="py-1">
                {DROP_TARGET_FOLDERS.map((target) => {
                  // Check if all selected emails can move to this target
                  const targetEmails = movePicker.emailIds
                    .map((id) => emails.find((em) => em.id === id))
                    .filter((em): em is Email => !!em);
                  const rejections = targetEmails
                    .map((em) => getDropRejectionReason(em, target))
                    .filter(Boolean);
                  const disabled = rejections.length === targetEmails.length;
                  const reason = disabled ? rejections[0] : null;

                  return (
                    <li key={target}>
                      <button
                        type="button"
                        disabled={disabled}
                        title={reason ?? undefined}
                        onClick={() => {
                          const validIds = targetEmails
                            .filter((em) => !getDropRejectionReason(em, target))
                            .map((em) => em.id);
                          if (validIds.length > 0) onMove?.(validIds, target);
                          setMovePicker(null);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm transition",
                          disabled
                            ? "opacity-40 cursor-not-allowed text-muted-foreground"
                            : "hover:bg-white/[0.06] text-foreground cursor-pointer",
                        )}
                      >
                        {getFolderLabel(target)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
