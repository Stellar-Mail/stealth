import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Mail, ShieldCheck, FileText, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Email } from "@/components/mail/data";
import { searchEmails } from "@/services/storage/search-index";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectEmail: (email: Email) => void;
};

export function SearchOverlay({ open, onClose, onSelectEmail }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Email[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchTime, setSearchTime] = useState(0);

  // Trigger search on query change
  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
      return;
    }

    const runSearch = async () => {
      const start = performance.now();
      const matched = await searchEmails(q);
      const end = performance.now();
      setResults(matched);
      setSearchTime(end - start);
      setActiveIndex(0);
    };

    runSearch();
  }, [q, open]);

  // Adjust active index within limits
  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, results.length - 1)));
  }, [results.length]);

  const handleSelect = (email: Email) => {
    onSelectEmail(email);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index - 1 + results.length) % results.length : 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const activeEmail = results[activeIndex];
      if (activeEmail) {
        handleSelect(activeEmail);
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* Dialog Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Local email search"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onKeyDown={handleKeyDown}
            className="glass-strong fixed left-1/2 top-24 z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
          >
            {/* Input bar */}
            <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search index by from, subject, body, proof ID..."
                className="w-full bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none"
              />
              {q && (
                <span className="text-[10px] text-muted-foreground bg-white/5 rounded-md px-1.5 py-0.5">
                  {searchTime.toFixed(1)}ms
                </span>
              )}
            </div>

            {/* Results body */}
            <ul className="max-h-[60vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <li className="px-3 py-12 text-center">
                  <div className="text-sm font-medium text-foreground/80">No results found</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    No matching records for &ldquo;{q}&rdquo;.
                  </div>
                </li>
              ) : (
                results.map((email, index) => {
                  const active = index === activeIndex;
                  return (
                    <SearchResultRow
                      key={email.id}
                      email={email}
                      active={active}
                      onHover={() => setActiveIndex(index)}
                      onClick={() => handleSelect(email)}
                    />
                  );
                })
              )}
            </ul>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/5 px-4 py-2 text-[10px] text-muted-foreground bg-black/10">
              <div className="flex items-center gap-3">
                <Hint keyLabel="↑↓">Navigate</Hint>
                <Hint keyLabel="↵">Open</Hint>
                <Hint keyLabel="esc">Close</Hint>
              </div>
              <div>
                IndexedDB &bull; Encrypted
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SearchResultRow({
  email,
  active,
  onHover,
  onClick,
}: {
  email: Email;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const hasAttachments = email.attachments && email.attachments.length > 0;

  return (
    <li>
      <button
        ref={ref}
        type="button"
        onMouseMove={onHover}
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition cursor-pointer",
          active ? "bg-white/[0.07] ring-1 ring-white/10" : "hover:bg-white/[0.04]"
        )}
      >
        <Mail className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-foreground/90 truncate">{email.from}</span>
            <span className="text-[10px] text-muted-foreground truncate">&lt;{email.email}&gt;</span>
            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{email.time}</span>
          </div>
          <div className="text-xs font-medium text-foreground/80 mt-0.5 truncate">
            {email.subject}
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
            {email.preview}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {hasAttachments && (
              <span className="inline-flex items-center gap-1 rounded bg-white/5 border border-white/10 px-1 py-0.5 text-[9px] text-muted-foreground">
                <FileText className="h-2.5 w-2.5" />
                {email.attachments?.length} File(s)
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 text-[9px] text-emerald-300">
              <ShieldCheck className="h-2.5 w-2.5" />
              Proof
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

function Hint({ keyLabel, children }: { keyLabel: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px]">
        {keyLabel}
      </kbd>
      {children}
    </span>
  );
}
