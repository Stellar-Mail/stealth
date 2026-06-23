/**
 * VendorMailTracker — root component for the Vendor Mail Tracker tool.
 *
 * ────────────────────────────────────────────────────────────────────────
 * ISOLATION NOTICE
 * This component is NOT mounted in the main application shell. It is a
 * self-contained tool in:
 *   src/tools/v2/team/vendor-mail-tracker/
 *
 * To preview it during development, render <VendorMailTracker /> in an
 * isolated test harness (see VendorMailTrackerPreview.tsx).
 *
 * A future follow-up issue will wire this to the main navigation and
 * mail engine. Do not import this from routes/, features/, or any shared
 * app shell code.
 * ────────────────────────────────────────────────────────────────────────
 *
 * Layout: 3-column on desktop (vendor list | thread list | detail panel),
 * stacked vertically on mobile.
 *
 * Accessibility:
 * - <main> landmark wraps the tool
 * - Each major panel is a <section> or <aside> with aria-label
 * - Live regions announce list changes (aria-live on ThreadList)
 * - Stats bar uses role="region" with descriptive label
 * - All interactive controls have visible focus via .glow-ring
 * - Keyboard shortcuts: Escape clears selection, / focuses search
 */

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { motionPresets } from "@/lib/motion-presets";
import { useFeedback, FeedbackViewport } from "@/features/design-system";
import { useVendorTracker } from "./hooks/use-vendor-tracker";
import { StatsBar } from "./components/stats-bar";
import { FilterBar } from "./components/filter-bar";
import { VendorSidebar } from "./components/vendor-sidebar";
import { ThreadList } from "./components/thread-list";
import { BoardView } from "./components/board-view";
import { ThreadDetail } from "./components/thread-detail";
import { AddVendorDialog } from "./components/add-vendor-dialog";
import { AddThreadDialog } from "./components/add-thread-dialog";

export function VendorMailTracker() {
  const tracker = useVendorTracker();
  const { notify, dismiss, items } = useFeedback();
  const searchRef = useRef<HTMLInputElement | null>(null);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // "/" focuses search (not in an input)
      if (e.key === "/" && !isEditable) {
        e.preventDefault();
        const el = document.getElementById("vmt-search") as HTMLInputElement | null;
        el?.focus();
      }

      // Escape clears selection when not in a dialog
      if (
        e.key === "Escape" &&
        !tracker.addVendorOpen &&
        !tracker.addThreadOpen
      ) {
        tracker.setSelectedThreadId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tracker]);

  // ── Action handlers with feedback ───────────────────────────────────────
  function handleResolve(threadId: string) {
    const thread = tracker.threads.find((t) => t.id === threadId);
    tracker.resolveThread(threadId);
    notify(`Thread "${thread?.subject.slice(0, 40) ?? "…"}" marked as resolved.`, {
      tone: "success",
    });
  }

  function handleSelectThread(id: string) {
    tracker.setSelectedThreadId(id === tracker.selectedThreadId ? null : id);
    tracker.markThreadRead(id);
  }

  const isFiltered =
    tracker.filter.query.trim() !== "" ||
    tracker.filter.status !== "all" ||
    tracker.filter.priority !== "all" ||
    tracker.filter.category !== "all" ||
    tracker.filter.vendorId !== "all";

  return (
    <>
      {/* ── Feedback toast viewport ───────────────────────────────────────── */}
      <FeedbackViewport items={items} onDismiss={dismiss} />

      {/* ── Add dialogs ───────────────────────────────────────────────────── */}
      <AddVendorDialog
        open={tracker.addVendorOpen}
        onClose={() => tracker.setAddVendorOpen(false)}
        onSubmit={(draft) => {
          tracker.addVendor(draft);
          notify(`Vendor "${draft.name}" added.`, { tone: "success" });
        }}
      />

      <AddThreadDialog
        open={tracker.addThreadOpen}
        vendors={tracker.vendors}
        defaultVendorId={tracker.selectedVendorId ?? undefined}
        onClose={() => tracker.setAddThreadOpen(false)}
        onSubmit={(draft) => {
          tracker.addThread(draft);
          notify(`Thread "${draft.subject.slice(0, 40)}" logged.`, { tone: "success" });
        }}
      />

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <main
        className="flex h-full min-h-screen flex-col bg-[oklch(0.18_0.005_270)] text-[oklch(0.96_0.005_270)]"
        aria-label="Vendor Mail Tracker"
      >
        {/* Skip nav link */}
        <a
          href="#vmt-thread-list"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-lg focus:border focus:border-white/20 focus:bg-[oklch(0.18_0.005_270)] focus:px-4 focus:py-2 focus:text-sm focus:text-foreground"
        >
          Skip to thread list
        </a>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="border-b border-white/[0.07] bg-white/[0.02] px-5 py-4">
          <div className="mx-auto max-w-screen-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-base font-semibold text-foreground">Vendor Mail Tracker</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Team tool · V2 ·{" "}
                  <span className="rounded border border-amber-300/25 bg-amber-300/10 px-1 py-0.5 text-[10px] text-amber-200">
                    Isolated — not linked to main app
                  </span>
                </p>
              </div>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                Press{" "}
                <kbd className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px]">
                  /
                </kbd>{" "}
                to search
              </p>
            </div>
          </div>
        </header>

        {/* ── Stats bar ───────────────────────────────────────────────────── */}
        <motion.div
          {...motionPresets.entrance.slideUp()}
          className="border-b border-white/[0.05] bg-white/[0.01] px-5 py-4"
        >
          <div className="mx-auto max-w-screen-xl">
            <StatsBar {...tracker.stats} />
          </div>
        </motion.div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="mx-auto flex w-full max-w-screen-xl flex-1 gap-0 overflow-hidden">
          {/* Sidebar */}
          <motion.div
            {...motionPresets.entrance.slideLeft()}
            className="hidden w-56 shrink-0 overflow-y-auto border-r border-white/[0.06] scrollbar-thin lg:block"
          >
            <VendorSidebar
              vendors={tracker.vendors}
              threads={tracker.threads}
              selectedVendorId={tracker.selectedVendorId}
              onSelectVendor={(id) => {
                tracker.setSelectedVendorId(id);
                // Sync filter
                tracker.setFilter((f) => ({ ...f, vendorId: id ?? "all" }));
              }}
            />
          </motion.div>

          {/* Thread list column */}
          <motion.section
            {...motionPresets.entrance.slideUp()}
            id="vmt-thread-list"
            aria-label="Vendor mail threads"
            className="flex min-w-0 flex-1 flex-col overflow-hidden"
          >
            {/* Filter bar */}
            <div className="border-b border-white/[0.06] bg-white/[0.01] px-4 py-3">
              <FilterBar
                filter={tracker.filter}
                vendors={tracker.vendors}
                viewMode={tracker.viewMode}
                onFilterChange={(patch) =>
                  tracker.setFilter((f) => ({ ...f, ...patch }))
                }
                onViewModeChange={tracker.setViewMode}
                onReset={tracker.resetFilters}
                onAddThread={() => tracker.setAddThreadOpen(true)}
                onAddVendor={() => tracker.setAddVendorOpen(true)}
              />
            </div>

            {/* List or board */}
            <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
              {tracker.viewMode === "list" ? (
                <ThreadList
                  threads={tracker.filteredThreads}
                  vendors={tracker.vendors}
                  isLoading={tracker.uiState.type === "loading"}
                  error={
                    tracker.uiState.type === "error" ? tracker.uiState.message : null
                  }
                  selectedThreadId={tracker.selectedThreadId}
                  sortField={tracker.sortField}
                  sortDir={tracker.sortDir}
                  onSort={tracker.toggleSort}
                  onSelect={handleSelectThread}
                  onResolve={handleResolve}
                  onReset={tracker.resetFilters}
                  isFiltered={isFiltered}
                />
              ) : (
                <BoardView
                  threads={tracker.filteredThreads}
                  vendors={tracker.vendors}
                  selectedThreadId={tracker.selectedThreadId}
                  onSelect={handleSelectThread}
                />
              )}
            </div>
          </motion.section>

          {/* Detail panel */}
          <AnimatePresence>
            {tracker.selectedThread && (
              <motion.aside
                key={tracker.selectedThread.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                aria-label="Thread detail"
                className="hidden w-72 shrink-0 overflow-y-auto border-l border-white/[0.06] scrollbar-thin lg:block xl:w-80"
              >
                <ThreadDetail
                  thread={tracker.selectedThread}
                  vendor={tracker.vendors.find(
                    (v) => v.id === tracker.selectedThread?.vendorId,
                  )}
                  onResolve={handleResolve}
                  onClose={() => tracker.setSelectedThreadId(null)}
                />
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
