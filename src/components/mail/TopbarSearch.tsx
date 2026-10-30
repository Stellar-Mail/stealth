// ---------------------------------------------------------------------------
// Issue #1972 (BETA-065) — Server-Backed Mailbox Search Component
//
// Interactive topbar search input with:
// - Privacy-safe metadata indexing notice
// - Debounced live search over server metadata + client decrypted local index
// - Quick filter chips (unread, attachments, date, folder)
// - Recent search history controls (add, remove single, clear all)
// - Highlighted text matching for keywords
// - Skeletons, error/offline recovery, empty states
// - Keyboard navigation (ArrowUp/Down, Enter, Esc), ARIA live announcements
// ---------------------------------------------------------------------------

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, History, Check, AlertCircle, RefreshCw, Clock, Star } from "lucide-react";
import {
  SearchIcon as Search,
  FilterIcon as Filter,
  AllMailIcon as Mail,
  IdentityIcon as User,
  DraftIcon as FileText,
  FilesIcon as Paperclip,
} from "@/features/design-system/components/mail-icons";

import type { Email } from "./data";
import { cn } from "@/lib/utils";
import { useMailSearch } from "@/features/mail/useMailSearch";
import type { SearchResultItemDto } from "@/lib/api";
import { SearchFilters } from "@/features/mail/SearchFilters";
import { parseSearchQuery } from "@/features/mail/searchUtils";
import "@/features/mail/search.css";

export interface TopbarSearchProps {
  actor?: string | null;
  emails?: Email[];
  onOpenPalette?: () => void;
  onSelectEmail?: (emailId: string, folder?: string) => void;
  onSelectContact?: (address: string) => void;
}

/**
 * Renders text with search keyword matches wrapped in a highlight `<mark>`.
 */
export function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <span>{text}</span>;

  const tokens = parseSearchQuery(query).tokens.filter((token) => token.length >= 2);

  if (tokens.length === 0) return <span>{text}</span>;

  // Escape tokens for regex
  const escapedTokens = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escapedTokens.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        const isMatch = tokens.some((t) => t.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <mark key={i} className="rounded-[2px] bg-primary/10 text-foreground text-inherit">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
}

export function TopbarSearch({
  actor = null,
  emails = [],
  onSelectEmail,
  onSelectContact,
}: TopbarSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [showFilters, setShowFilters] = useState(false);

  const search = useMailSearch({
    actor,
    emails,
    onSelectEmail,
  });

  const {
    rawQuery,
    setRawQuery,
    filters,
    setFilters,
    isOpen,
    setIsOpen,
    history,
    removeHistory,
    clearHistory,
    results,
    isLoading,
    isError,
    error,
    retry,
    handleSelectResult,
    handleSelectHistoryItem,
  } = search;

  const selectResult = (item: SearchResultItemDto) => {
    if (item.type === "contact") {
      if (rawQuery.trim()) search.addHistory(rawQuery.trim());
      setIsOpen(false);
      onSelectContact?.(item.senderId);
    } else {
      handleSelectResult(item);
    }
  };

  const closePanel = () => {
    inputRef.current?.focus();
    setIsOpen(false);
    setShowFilters(false);
    setActiveIndex(-1);
  };

  useEffect(() => {
    setActiveIndex(-1);
  }, [rawQuery, filters]);

  useEffect(() => {
    if (activeIndex >= 0)
      document
        .getElementById(`mail-search-option-${activeIndex}`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  // Update positioning of dropdown when opened or on window resize
  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (containerRef.current) {
        setDropdownRect(containerRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: Event) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("pointerdown", onClickOutside);
    document.addEventListener("focusin", onClickOutside);
    return () => {
      document.removeEventListener("pointerdown", onClickOutside);
      document.removeEventListener("focusin", onClickOutside);
    };
  }, [isOpen, setIsOpen]);

  // Keyboard navigation inside search dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const maxItems = isQueryActive ? results.length : history.length;
      if (maxItems > 0) {
        setActiveIndex((prev) => (prev + 1) % maxItems);
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) return;
      const maxItems = isQueryActive ? results.length : history.length;
      if (maxItems > 0) {
        setActiveIndex((prev) => (prev <= 0 ? maxItems - 1 : prev - 1));
      }
      return;
    }

    if (e.key === "Enter") {
      if (isOpen && activeIndex >= 0) {
        e.preventDefault();
        if (isQueryActive && results[activeIndex]) {
          selectResult(results[activeIndex]);
        } else if (!isQueryActive && history[activeIndex]) {
          handleSelectHistoryItem(history[activeIndex]);
        }
      } else if (rawQuery.trim()) {
        search.addHistory(rawQuery.trim());
        setShowFilters(false);
        setIsOpen(true);
      }
    }
  };

  const isQueryActive =
    Boolean(rawQuery.trim()) || Object.values(filters).some((v) => v !== undefined);

  return (
    <div
      ref={containerRef}
      data-open={isOpen}
      className="mail-search relative flex h-9 min-w-0 flex-1 items-center md:min-w-[220px]"
    >
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={isOpen && !showFilters}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls={isOpen && !showFilters ? "mail-search-options" : undefined}
        aria-activedescendant={
          isOpen && !showFilters && activeIndex >= 0
            ? `mail-search-option-${activeIndex}`
            : undefined
        }
        aria-label="Search messages, contacts, and drafts"
        value={rawQuery}
        onChange={(e) => {
          setRawQuery(e.target.value);
          if (!isOpen) setIsOpen(true);
          setActiveIndex(-1);
          setShowFilters(false);
        }}
        onFocus={() => {
          setShowFilters(false);
          setIsOpen(true);
          if (containerRef.current) {
            setDropdownRect(containerRef.current.getBoundingClientRect());
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search messages, contacts, drafts"
        className={cn(
          "mail-search-input h-9 w-full min-w-0 pl-9 text-[13px] text-foreground placeholder:text-muted-foreground/70",
          isQueryActive ? "pr-16" : "pr-12",
        )}
      />

      <div className="absolute right-1.5 flex items-center gap-1">
        {isQueryActive && (
          <button
            type="button"
            aria-label="Clear search text"
            onClick={() => {
              setRawQuery("");
              setFilters({});
              inputRef.current?.focus();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-surface-tint/10 hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          aria-label="Search filters"
          aria-expanded={isOpen && showFilters}
          aria-controls={isOpen && showFilters ? "search-dropdown-panel" : undefined}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setShowFilters(!showFilters || !isOpen);
            setIsOpen(!showFilters || !isOpen);
          }}
          className="glow-ring flex h-7 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-tint/[0.07] hover:text-foreground aria-expanded:bg-surface-tint/[0.08] aria-expanded:text-foreground"
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {/* Screen Reader live region */}
      <div className="sr-only" aria-live="polite">
        {isOpen && isQueryActive
          ? isLoading
            ? "Searching mailbox..."
            : `${results.length} search result${results.length === 1 ? "" : "s"} found.`
          : ""}
      </div>

      {/* Search Dropdown Portal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                <motion.div
                  ref={panelRef}
                  id="search-dropdown-panel"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closePanel();
                    }
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: "fixed",
                    top: dropdownRect ? dropdownRect.bottom - 1 : 46,
                    left: dropdownRect
                      ? Math.max(
                          8,
                          Math.min(
                            dropdownRect.left,
                            typeof window !== "undefined"
                              ? window.innerWidth -
                                  Math.min(window.innerWidth - 16, dropdownRect.width) -
                                  8
                              : 8,
                          ),
                        )
                      : 8,
                    width: dropdownRect
                      ? Math.min(
                          typeof window !== "undefined" ? window.innerWidth - 16 : 420,
                          dropdownRect.width,
                        )
                      : Math.min(typeof window !== "undefined" ? window.innerWidth - 16 : 420, 420),
                    maxHeight: "calc(100vh - 80px)",
                    zIndex: 110,
                  }}
                  className="mail-search-panel"
                >
                  {showFilters ? (
                    <SearchFilters
                      value={filters}
                      query={rawQuery}
                      onQueryChange={setRawQuery}
                      onApply={(next) => {
                        setFilters(next);
                        setShowFilters(false);
                        if (rawQuery.trim()) search.addHistory(rawQuery.trim());
                        inputRef.current?.focus();
                      }}
                      onClose={closePanel}
                    />
                  ) : (
                    <>
                      {/* Quick Filters Bar */}
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-surface-tint/[0.06] bg-surface-tint/[0.015] px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFilters({ ...filters, unread: filters.unread ? undefined : true })
                          }
                          className={cn(
                            "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition",
                            filters.unread
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-surface-tint/[0.04] text-muted-foreground hover:bg-surface-tint/[0.08] hover:text-foreground",
                          )}
                        >
                          <Check
                            className={cn("h-3 w-3", filters.unread ? "opacity-100" : "opacity-0")}
                          />
                          Unread
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFilters({
                              ...filters,
                              hasAttachments: filters.hasAttachments ? undefined : true,
                            })
                          }
                          className={cn(
                            "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition",
                            filters.hasAttachments
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-surface-tint/[0.04] text-muted-foreground hover:bg-surface-tint/[0.08] hover:text-foreground",
                          )}
                        >
                          <Paperclip className="h-3 w-3" />
                          Attachments
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFilters({
                              ...filters,
                              folder: filters.folder === "inbox" ? undefined : "inbox",
                            })
                          }
                          className={cn(
                            "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition",
                            filters.folder === "inbox"
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-surface-tint/[0.04] text-muted-foreground hover:bg-surface-tint/[0.08] hover:text-foreground",
                          )}
                        >
                          <Mail className="h-3 w-3" />
                          Inbox
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFilters({
                              ...filters,
                              starred: filters.starred ? undefined : true,
                            })
                          }
                          className={cn(
                            "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition",
                            filters.starred
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-surface-tint/[0.04] text-muted-foreground hover:bg-surface-tint/[0.08] hover:text-foreground",
                          )}
                        >
                          <Star className="h-3 w-3" />
                          Starred
                        </button>

                        {Object.values(filters).some((v) => v !== undefined) && (
                          <button
                            type="button"
                            onClick={() => setFilters({})}
                            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                          >
                            Reset filters
                          </button>
                        )}
                      </div>

                      {/* Results & History Container */}
                      <div className="max-h-[380px] overflow-y-auto p-2 scrollbar-thin">
                        {((isQueryActive && results.length === 0) ||
                          (!isQueryActive && history.length === 0)) && (
                          <ul id="mail-search-options" role="listbox" aria-label="Search results" />
                        )}
                        {/* Error State */}
                        {isError && (
                          <div className="my-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-destructive">
                              <AlertCircle className="h-4 w-4" />
                              Failed to load search results
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {error?.message || "Search request timed out or was unavailable."}
                            </p>
                            <button
                              type="button"
                              onClick={retry}
                              className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-surface-tint/[0.08] px-2.5 py-1 text-xs text-foreground transition hover:bg-surface-tint/[0.14]"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry Search
                            </button>
                          </div>
                        )}

                        {/* Loading Skeletons */}
                        {isQueryActive && isLoading && results.length === 0 && (
                          <div className="space-y-2 py-2">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="flex animate-pulse items-center gap-3 rounded-lg bg-surface-tint/[0.03] p-2.5"
                              >
                                <div className="h-8 w-8 rounded-md bg-surface-tint/[0.06]" />
                                <div className="flex-1 space-y-1.5">
                                  <div className="h-3.5 w-1/3 rounded bg-surface-tint/[0.06]" />
                                  <div className="h-2.5 w-2/3 rounded bg-surface-tint/[0.04]" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Populated Results */}
                        {isQueryActive && results.length > 0 && (
                          <div>
                            <div className="mb-1.5 flex items-center justify-between px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              <span>Search Results</span>
                              <span>{results.length} found</span>
                            </div>
                            <ul
                              id="mail-search-options"
                              role="listbox"
                              aria-label="Search results"
                              className="space-y-1"
                            >
                              {results.map((item, index) => {
                                const isSelected = activeIndex === index;
                                return (
                                  <li role="none" key={`${item.type}-${item.id}`}>
                                    <button
                                      type="button"
                                      role="option"
                                      id={`mail-search-option-${index}`}
                                      aria-selected={isSelected}
                                      onClick={() => selectResult(item)}
                                      onMouseEnter={() => setActiveIndex(index)}
                                      className={cn(
                                        "flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition",
                                        isSelected
                                          ? "bg-surface-tint/[0.09] text-foreground"
                                          : "text-muted-foreground hover:bg-surface-tint/[0.04] hover:text-foreground",
                                      )}
                                    >
                                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-tint/[0.06] text-muted-foreground">
                                        {item.type === "contact" ? (
                                          <User className="h-3.5 w-3.5" />
                                        ) : item.type === "draft" ? (
                                          <FileText className="h-3.5 w-3.5" />
                                        ) : (
                                          <Mail className="h-3.5 w-3.5" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="truncate text-xs font-medium text-foreground">
                                            <HighlightedText
                                              text={item.subject || item.senderId}
                                              query={rawQuery}
                                            />
                                          </span>
                                          <span className="shrink-0 rounded bg-surface-tint/[0.06] px-1.5 py-0.2 text-[9px] font-mono capitalize text-muted-foreground">
                                            {item.folder}
                                          </span>
                                        </div>
                                        <p className="truncate text-[11px] text-muted-foreground/80">
                                          <HighlightedText
                                            text={item.preview || item.senderId}
                                            query={rawQuery}
                                          />
                                        </p>
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {/* Empty State when query returned 0 results */}
                        {!isLoading && !isError && isQueryActive && results.length === 0 && (
                          <div className="py-8 text-center">
                            <Search className="mx-auto h-6 w-6 text-muted-foreground/40" />
                            <p className="mt-2 text-xs font-medium text-foreground">
                              No matches found for &ldquo;{rawQuery}&rdquo;
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Try searching by sender address, clearing filters, or checking
                              spelling.
                            </p>
                          </div>
                        )}

                        {/* Recent Search History (shown when query is empty or history exists) */}
                        {!isQueryActive && history.length > 0 && (
                          <div>
                            <div className="mb-1.5 flex items-center justify-between px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <History className="h-3 w-3" /> Recent Searches
                              </span>
                              <button
                                type="button"
                                onClick={clearHistory}
                                className="text-[10px] text-muted-foreground hover:text-foreground"
                              >
                                Clear All
                              </button>
                            </div>
                            <ul
                              id="mail-search-options"
                              role="listbox"
                              aria-label="Recent searches"
                              className="space-y-0.5"
                            >
                              {history.map((histItem, index) => {
                                const isSelected = activeIndex === index;
                                return (
                                  <li
                                    key={histItem}
                                    role="none"
                                    className={cn(
                                      "group flex items-center justify-between rounded-lg px-2 py-1.5 transition",
                                      isSelected
                                        ? "bg-surface-tint/[0.09]"
                                        : "hover:bg-surface-tint/[0.04]",
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleSelectHistoryItem(histItem)}
                                      role="option"
                                      id={`mail-search-option-${index}`}
                                      aria-selected={isSelected}
                                      className="flex flex-1 items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
                                    >
                                      <Clock className="h-3 w-3 text-muted-foreground/50" />
                                      <span>{histItem}</span>
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Remove ${histItem} from history`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeHistory(histItem);
                                      }}
                                      className="h-5 w-5 rounded p-0.5 text-muted-foreground/50 opacity-0 transition hover:text-foreground group-hover:opacity-100"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {!isQueryActive && history.length === 0 && (
                          <div className="py-6 text-center text-xs text-muted-foreground">
                            <p>Type to search across metadata, headers, contacts and drafts.</p>
                            <p className="mt-1 text-[11px] text-muted-foreground/70">
                              Try queries like{" "}
                              <code className="rounded bg-surface-tint/[0.06] px-1 font-mono text-[10px]">
                                from:marcus
                              </code>
                              ,{" "}
                              <code className="rounded bg-surface-tint/[0.06] px-1 font-mono text-[10px]">
                                is:unread
                              </code>
                              , or keywords.
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
                        Unlocked message bodies are searched only on this device.
                      </p>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
