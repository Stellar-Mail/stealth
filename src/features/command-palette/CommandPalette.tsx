import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CornerDownLeft,
  Folder,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Email, MailFolder } from "@/components/mail/data";
import { buildPaletteModel, selectableRows, type PaletteRow, type PaletteSection } from "./search";
import type { CommandContext, CommandId, ResolvedCommand } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  context: CommandContext;
  emails: Email[];
  /** Run a command. `email` overrides the context target (used by proof results). */
  onRunCommand: (id: CommandId, email?: Email) => void;
  onNavigate: (folder: MailFolder) => void;
  onSelectEmail: (email: Email) => void;
  onOpenSettings: (settingId: string) => void;
};

export function CommandPalette({
  open,
  onClose,
  context,
  emails,
  onRunCommand,
  onNavigate,
  onSelectEmail,
  onOpenSettings,
}: Props) {
  const [q, setQ] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [confirming, setConfirming] = useState<ResolvedCommand | null>(null);

  const sections = useMemo(() => buildPaletteModel(context, q, emails), [context, q, emails]);
  const selectable = useMemo(() => selectableRows(sections), [sections]);
  const selectableIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    selectable.forEach((row, index) => map.set(row.key, index));
    return map;
  }, [selectable]);

  // Reset transient state when opening/closing or when the query changes.
  useEffect(() => {
    if (!open) {
      setQ("");
      setConfirming(null);
    }
  }, [open]);
  useEffect(() => setActiveIndex(0), [q]);
  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, selectable.length - 1)));
  }, [selectable.length]);

  const activate = (row: PaletteRow) => {
    switch (row.type) {
      case "command": {
        if (!row.command.availability.enabled) return;
        if (row.command.dangerous && row.command.confirm) {
          setConfirming(row.command);
          return;
        }
        onRunCommand(row.command.id);
        onClose();
        return;
      }
      case "folder":
        onNavigate(row.folder);
        onClose();
        return;
      case "sender":
        onSelectEmail(row.email);
        onClose();
        return;
      case "proof":
        onRunCommand("inspect-proof", row.email);
        onClose();
        return;
      case "setting":
        onOpenSettings(row.setting.id);
        onClose();
        return;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (confirming) {
      if (event.key === "Enter") {
        event.preventDefault();
        onRunCommand(confirming.id);
        onClose();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirming(null);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (selectable.length ? (index + 1) % selectable.length : 0));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        selectable.length ? (index - 1 + selectable.length) % selectable.length : 0,
      );
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = selectable[activeIndex];
      if (row) activate(row);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onKeyDown={handleKeyDown}
            className="glass-strong fixed left-1/2 top-24 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl"
          >
            {confirming ? (
              <ConfirmPanel
                command={confirming}
                onConfirm={() => {
                  onRunCommand(confirming.id);
                  onClose();
                }}
                onCancel={() => setConfirming(null)}
              />
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    placeholder="Run a command or search folders, senders, proofs…"
                    className="w-full bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none"
                  />
                  {context.email && (
                    <span className="hidden max-w-[140px] truncate rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
                      {context.email.from}
                    </span>
                  )}
                </div>
                <ul className="max-h-[60vh] overflow-y-auto p-2">
                  {sections.length === 0 && (
                    <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No matches for “{q}”.
                    </li>
                  )}
                  {sections.map((section) => (
                    <PaletteSectionView
                      key={section.id}
                      section={section}
                      activeIndex={activeIndex}
                      selectableIndexByKey={selectableIndexByKey}
                      onHover={setActiveIndex}
                      onActivate={activate}
                    />
                  ))}
                </ul>
                <div className="flex items-center gap-3 border-t border-white/5 px-4 py-2 text-[10px] text-muted-foreground">
                  <Hint keyLabel="↑↓">Navigate</Hint>
                  <Hint keyLabel="↵">Run</Hint>
                  <Hint keyLabel="esc">Close</Hint>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PaletteSectionView({
  section,
  activeIndex,
  selectableIndexByKey,
  onHover,
  onActivate,
}: {
  section: PaletteSection;
  activeIndex: number;
  selectableIndexByKey: Map<string, number>;
  onHover: (index: number) => void;
  onActivate: (row: PaletteRow) => void;
}) {
  return (
    <>
      <li className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {section.title}
      </li>
      {section.rows.map((row) => {
        const selectableIndex = selectableIndexByKey.get(row.key);
        const active = selectableIndex === activeIndex;
        return (
          <RowView
            key={row.key}
            row={row}
            active={active}
            onHover={() => selectableIndex !== undefined && onHover(selectableIndex)}
            onActivate={() => onActivate(row)}
          />
        );
      })}
    </>
  );
}

function RowView({
  row,
  active,
  onHover,
  onActivate,
}: {
  row: PaletteRow;
  active: boolean;
  onHover: () => void;
  onActivate: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const meta = rowMeta(row);
  const disabled = row.type === "command" && !row.command.availability.enabled;
  const help =
    row.type === "command" && !row.command.availability.enabled
      ? row.command.availability.help
      : undefined;

  return (
    <li>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onMouseMove={onHover}
        onClick={onActivate}
        aria-disabled={disabled}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
          disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
          active && !disabled && "bg-white/[0.07] ring-1 ring-white/10",
          !active && !disabled && "hover:bg-white/[0.05]",
        )}
      >
        <meta.Icon
          className={cn("h-4 w-4 shrink-0", meta.danger ? "text-red-300" : "text-muted-foreground")}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground/90">{meta.label}</span>
          {(help ?? meta.sub) && (
            <span
              className={cn(
                "block truncate text-[11px]",
                help ? "text-amber-200/80" : "text-muted-foreground",
              )}
            >
              {help ?? meta.sub}
            </span>
          )}
        </span>
        {meta.hint && !disabled && (
          <span className="ml-auto rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {meta.hint}
          </span>
        )}
        {meta.danger && !disabled && (
          <span className="rounded-md border border-red-300/20 bg-red-300/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-red-200">
            confirm
          </span>
        )}
      </button>
    </li>
  );
}

type RowMeta = { Icon: LucideIcon; label: string; sub?: string; hint?: string; danger?: boolean };

function rowMeta(row: PaletteRow): RowMeta {
  switch (row.type) {
    case "command":
      return {
        Icon: row.command.icon,
        label: row.command.label,
        sub: row.command.description,
        hint: row.command.hint,
        danger: row.command.dangerous,
      };
    case "folder":
      return { Icon: Folder, label: `Go to ${row.label}`, sub: "Folder" };
    case "sender":
      return { Icon: User, label: row.email.from, sub: row.email.email };
    case "proof":
      return { Icon: ShieldCheck, label: row.proof, sub: row.email.subject };
    case "setting":
      return { Icon: SlidersHorizontal, label: row.setting.label, sub: "Settings" };
  }
}

function ConfirmPanel({
  command,
  onConfirm,
  onCancel,
}: {
  command: ResolvedCommand;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-red-300/25 bg-red-300/10 text-red-200">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{command.confirm?.title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{command.confirm?.body}</p>
        </div>
      </div>
      <div className="mt-5 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
        >
          Cancel
        </button>
        <button
          autoFocus
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
        >
          {command.confirm?.confirmLabel}
          <CornerDownLeft className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
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
