import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, Search, Slash } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHORTCUT_DEFINITIONS } from "./shortcuts";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ShortcutOverlay({ open, onClose }: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const shortcuts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SHORTCUT_DEFINITIONS;
    return SHORTCUT_DEFINITIONS.filter((shortcut) =>
      [
        shortcut.label,
        shortcut.description,
        shortcut.keys.join(" "),
        shortcut.keywords.join(" "),
        shortcut.conflict ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[170] bg-black/55 backdrop-blur-md"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="glass-strong fixed left-1/2 top-1/2 z-[180] grid w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px] border border-white/10"
          >
            <div className="border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.06]">
                  <Keyboard className="h-4.5 w-4.5 text-foreground/85" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Search every shortcut in one place. Shortcuts pause automatically while typing
                    in inputs, editors, and custom text fields.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 transition focus-within:border-white/20 focus-within:bg-black/30">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search shortcuts, commands, or conflict notes…"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                />
              </div>
            </div>

            <div className="max-h-[58vh] overflow-y-auto px-3 py-3">
              {shortcuts.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No shortcuts match “{query}”.
                </div>
              ) : (
                <ul className="space-y-2">
                  {shortcuts.map((shortcut) => (
                    <li
                      key={shortcut.id}
                      className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground">
                            {shortcut.label}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-muted-foreground">
                            {shortcut.description}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {shortcut.keys.map((key) => (
                            <kbd
                              key={`${shortcut.id}-${key}`}
                              className="rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono text-[11px] text-muted-foreground"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                      {shortcut.conflict && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200/10 bg-amber-200/[0.05] px-3 py-2 text-[11px] leading-5 text-amber-100/80">
                          <Slash className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{shortcut.conflict}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-white/8 px-5 py-3 text-[11px] text-muted-foreground">
              <Hint keyLabel="?">Open help</Hint>
              <Hint keyLabel="Ctrl/Cmd K">Search commands</Hint>
              <Hint keyLabel="Esc">Close</Hint>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}

function Hint({ keyLabel, children }: { keyLabel: string; children: React.ReactNode }) {
  return (
    <span className={cn("flex items-center gap-1.5")}>
      <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px]">
        {keyLabel}
      </kbd>
      <span>{children}</span>
    </span>
  );
}
