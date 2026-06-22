import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, FolderInput } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ConvertSenderButton } from "@/features/sender-conversion";
import { MobileMailCard } from "./MobileMailCard";
import { EmailTrustBadges } from "./EmailTrustBadges";
import { BulkActionBar } from "./BulkActionBar";
import type { BulkActionRequest, BulkFailure, BulkProgressState } from "./bulk-actions";
import { canDragEmail, DROP_TARGET_FOLDERS, getDropRejectionReason } from "./useDragDrop";

type FilterTab = "all" | "unread" | "flagged";

export function EmailList({
  emails,
  selectedId,
  selectedIds,
  onSelect,
  onSelectionChange,
  onBulkAction,
  bulkProgress,
  bulkFailures,
  onConvertSender,
  folder,
  filters,
  customFolder,
  compact,
  showAvatars,
  useMobile,
  onArchive,
  onStar,
  onSnooze,
  onMove,
}: {
  emails: Email[];
  selectedId: string | null;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onSelectionChange: (ids: string[]) => void;
  onBulkAction: (request: BulkActionRequest) => void;
  bulkProgress: BulkProgressState | null;
  bulkFailures: BulkFailure[];
  onConvertSender: (email: Email) => void;
  folder: MailFolder;
  filters: MailFilters;
  customFolder?: string | null;
  compact: boolean;
  showAvatars: boolean;
  useMobile?: boolean;
  onArchive?: (email: Email) => void;
  onStar?: (email: Email) => void;
  onSnooze?: (email: Email) => void;
  onMove?: (emailIds: string[], target: MailLocation) => void;
}) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const folderLabel = customFolder ?? getFolderLabel(folder);
  const [movePicker, setMovePicker] = useState<{ emailIds: string[] } | null>(null);

  const folderEmails = customFolder
    ? emails.filter((email) =>
        email.labels?.some((label) => label.toLowerCase() === customFolder.toLowerCase()),
      )
    : getEmailsForFolder(emails, folder);

  const filtered = applyMailFilters(folderEmails, filters).filter((e) => {
    if (activeTab === "unread") return e.unread;
    if (activeTab === "flagged") return e.starred;
    return true;
  });
  const visibleIds = filtered.map((email) => email.id);
  const selectedVisibleIds = visibleIds.filter((id) => selectedIds.includes(id));
  const selectedEmails = selectedIds
    .map((id) => emails.find((email) => email.id === id))
    .filter((email): email is Email => Boolean(email));
  const allSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;
  const someSelected = selectedVisibleIds.length > 0;
  const listRef = useRef<HTMLUListElement>(null);
  const onSelectRef = useRef(onSelect);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const [lastAnchorId, setLastAnchorId] = useState<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  });

  useEffect(() => {
    const visible = new Set(visibleIds);
    const next = selectedIds.filter((id) => visible.has(id));
    if (next.length !== selectedIds.length) onSelectionChangeRef.current(next);
  });

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        onSelectionChangeRef.current(visibleIds);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (movePicker) {
          setMovePicker(null);
          return;
        }
        onSelectionChangeRef.current([]);
      }
      if (event.key === "m" || event.key === "M") {
        const focused = document.activeElement;
        if (focused && ["INPUT", "TEXTAREA", "SELECT"].includes((focused as HTMLElement).tagName))
          return;
        event.preventDefault();
        const ids = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
        if (ids.length > 0) setMovePicker({ emailIds: ids });
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[role="checkbox"], input, button[aria-label^="Select"]')) return;

      const row = target.closest<HTMLElement>("[data-email-id]");
      const id = row?.dataset.emailId;
      if (!id || !node.contains(row)) return;

      onSelectRef.current(id);
    };

    node.addEventListener("pointerdown", onPointerDown, true);
    return () => node.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChangeRef.current(visibleIds.filter((visibleId) => next.has(visibleId)));
    setLastAnchorId(id);
  };

  const selectRange = (id: string) => {
    const anchor = lastAnchorId ?? id;
    const startIndex = visibleIds.indexOf(anchor);
    const endIndex = visibleIds.indexOf(id);

    if (startIndex === -1 || endIndex === -1) {
      toggleSelection(id);
      return;
    }

    const range = new Set(
      visibleIds.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1),
    );
    const next = new Set(selectedIds);
    range.forEach((rangeId) => {
      if (next.has(rangeId)) {
        next.delete(rangeId);
      } else {
        next.add(rangeId);
      }
    });
    onSelectionChangeRef.current(visibleIds.filter((visibleId) => next.has(visibleId)));
    setLastAnchorId(id);
  };

  const toggleAllSelection = () => {
    onSelectionChangeRef.current(allSelected ? [] : visibleIds);
  };

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

      <BulkActionBar
        selectedEmails={selectedEmails}
        folder={folder}
        customFolder={customFolder}
        onAction={onBulkAction}
        onClearSelection={() => onSelectionChange([])}
        bulkProgress={bulkProgress}
        bulkFailures={bulkFailures}
      />

      <ul
        ref={listRef}
        role="listbox"
        aria-multiselectable="true"
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
        {filtered.length > 0 && (
          <li className="sticky top-0 z-10 -mx-1 px-1 py-1">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1.5 text-[11px] text-muted-foreground">
              <Checkbox
                checked={allSelected}
                aria-label={
                  allSelected ? "Clear all visible messages" : "Select all visible messages"
                }
                onCheckedChange={toggleAllSelection}
              />
              <button
                type="button"
                onClick={toggleAllSelection}
                className="flex-1 truncate text-left text-foreground/88 transition hover:text-foreground"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
              <span className="shrink-0 tabular-nums">
                {someSelected
                  ? `${selectedVisibleIds.length} selected`
                  : `${filtered.length} conversations`}
              </span>
              <span className="hidden xl:inline text-[10px] text-muted-foreground/70">
                Ctrl/⌘+A · Esc
              </span>
            </div>
          </li>
        )}
        {filtered.map((e, idx) => {
          const active = selectedId === e.id || selectedIds.includes(e.id);
          const selected = selectedIds.includes(e.id);
          const selectMessage = (shiftKey = false) => {
            if (shiftKey && lastAnchorId) {
              selectRange(e.id);
            } else {
              onSelect(e.id);
            }
          };

          if (useMobile) {
            return (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <div className="flex items-start gap-2 px-1">
                  <Checkbox
                    checked={selected}
                    aria-label={`Select ${e.from}: ${e.subject}`}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    onCheckedChange={() => toggleSelection(e.id)}
                    className="mt-3 border-white/15 bg-white/[0.035] data-[state=checked]:border-white/30"
                  />
                  <div className="min-w-0 flex-1">
                    <MobileMailCard
                      email={e}
                      selected={active}
                      onSelect={() => onSelect(e.id)}
                      onArchive={() => onArchive?.(e)}
                      onStar={() => onStar?.(e)}
                      onSnooze={() => onSnooze?.(e)}
                    />
                  </div>
                </div>
                {e.folder === "requests" && (
                  <div className="mt-1 flex justify-end px-2">
                    <ConvertSenderButton
                      variant="subtle"
                      label="Review sender"
                      onClick={() => onConvertSender(e)}
                    />
                  </div>
                )}
              </motion.li>
            );
          }

          return (
            <motion.li
              key={e.id}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02, duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div
                className="flex items-start gap-2"
                onPointerDown={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (target?.closest('[role="checkbox"], input, button[aria-label^="Select"]')) {
                    return;
                  }
                  selectMessage(event.shiftKey);
                }}
              >
                <Checkbox
                  checked={selected}
                  aria-label={`Select ${e.from}: ${e.subject}`}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  onCheckedChange={() => toggleSelection(e.id)}
                  className="mt-2.5 border-white/15 bg-white/[0.035] data-[state=checked]:border-white/30"
                />
                <motion.button
                  data-email-id={e.id}
                  onClick={(event) => selectMessage(event.shiftKey)}
                  whileTap={{ scale: 0.975 }}
                  transition={{ type: "spring", stiffness: 520, damping: 30 }}
                  aria-selected={active}
                  className={cn(
                    "mail-preview-card group relative flex w-full items-start gap-3 px-3 text-left transition-[background,border-color,box-shadow,transform] duration-300",
                    active
                      ? "-translate-y-px border-white/15 bg-[oklch(0.38_0.007_270/0.55)] py-2 shadow-[0_18px_42px_oklch(0_0_0/0.35),0_0_0_1px_oklch(1_0_0/0.07),inset_0_1px_0_oklch(1_0_0/0.14)]"
                      : compact
                        ? "py-2"
                        : "py-2.5",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="email-active"
                      className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-white/12"
                      style={{
                        background:
                          "radial-gradient(circle at 18% 22%, oklch(1 0 0 / 0.12), transparent 36%), linear-gradient(135deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.025) 44%, oklch(1 0 0 / 0.01))",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  {showAvatars && (
                    <div
                      className={cn(
                        "relative shrink-0 overflow-hidden rounded-full ring-1 ring-white/15 shadow-[0_8px_18px_-12px_rgba(0,0,0,0.9)]",
                        active ? "h-[30px] w-[30px]" : "h-7 w-7",
                      )}
                    >
                      <img
                        src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(e.from)}&backgroundColor=1a1a1d`}
                        alt={e.from}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {e.unread && (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[oklch(0.9_0.005_270)] ring-2 ring-[oklch(0.18_0.005_270)]" />
                      )}
                    </div>
                  )}
                  <div className="relative min-w-0 flex-1">
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
              </div>
              {e.folder === "requests" && (
                <div className="mt-1 flex justify-end px-2">
                  <ConvertSenderButton
                    variant="subtle"
                    label="Review sender"
                    onClick={() => onConvertSender(e)}
                  />
                </div>
              )}
            </motion.li>
          );
        })}
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
            <div className="w-56 rounded-xl border border-white/12 bg-[oklch(0.15_0.005_270)] shadow-2xl overflow-hidden">
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
