import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Archive,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  FileText,
  Hash,
  Inbox,
  Lock,
  Mail,
  Pencil,
  Plus,
  ReceiptText,
  Send,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MailFolder } from "./data";
import { DROP_TARGET_FOLDERS } from "./useDragDrop";

type SidebarItem = { key: MailFolder; label: string; icon: LucideIcon };

const mailItems: SidebarItem[] = [
  { key: "all", label: "All Mail", icon: Mail },
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "priority", label: "Priority", icon: Sparkles },
  { key: "snoozed", label: "Snoozed", icon: Clock3 },
  { key: "starred", label: "Starred", icon: Star },
  { key: "drafts", label: "Drafts", icon: FileText },
  { key: "sent", label: "Sent", icon: Send },
];

const protocolItems: SidebarItem[] = [
  { key: "verified", label: "Verified", icon: ShieldCheck },
  { key: "pending", label: "Pending Proof", icon: Clock3 },
  { key: "requests", label: "Requests", icon: Users },
  { key: "encrypted", label: "Encrypted", icon: Lock },
];

const deliveryItems: SidebarItem[] = [
  { key: "receipts", label: "Receipts", icon: ReceiptText },
  { key: "outbox", label: "Outbox", icon: SendHorizontal },
  { key: "scheduled", label: "Scheduled", icon: CalendarClock },
];

const storageItems: SidebarItem[] = [
  { key: "archive", label: "Archive", icon: Archive },
  { key: "spam", label: "Spam", icon: ShieldAlert },
  { key: "trash", label: "Trash", icon: Trash2 },
];

const sections: { title?: string; items: SidebarItem[] }[] = [
  { items: mailItems },
  { title: "Protocol", items: protocolItems },
  { title: "Delivery", items: deliveryItems },
  { title: "Storage", items: storageItems },
];

const defaultFolders = [
  { name: "Clients", color: "oklch(0.85 0.005 270)" },
  { name: "Investors", color: "oklch(0.75 0.005 270)" },
  { name: "Personal", color: "oklch(0.65 0.005 270)" },
];

const folderColors = [
  "oklch(0.85 0.005 270)",
  "oklch(0.75 0.005 270)",
  "oklch(0.65 0.005 270)",
  "oklch(0.80 0.02 200)",
  "oklch(0.80 0.02 150)",
];

export function Sidebar({
  active,
  counts,
  onSelect,
  collapsed,
  onToggle,
  onCompose,
  customFolder,
  onSelectCustomFolder,
  onDrop,
}: {
  active: MailFolder;
  counts: Partial<Record<MailFolder, number>>;
  onSelect: (f: MailFolder) => void;
  collapsed: boolean;
  onToggle: () => void;
  onCompose: () => void;
  customFolder?: string | null;
  onSelectCustomFolder?: (name: string | null) => void;
  onDrop?: (emailIds: string[], target: MailFolder) => void;
}) {
  const [folders, setFolders] = useState(defaultFolders);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddingFolder && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingFolder]);

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      const color = folderColors[folders.length % folderColors.length];
      setFolders([...folders, { name: newFolderName.trim(), color }]);
      setNewFolderName("");
      setIsAddingFolder(false);
    }
  };
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 264 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="glass relative z-10 hidden h-screen flex-col rounded-none border-y-0 border-l-0 p-3 md:flex"
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--gradient-silver)" }}
        >
          <Sparkles className="h-4 w-4 text-[oklch(0.2_0.005_270)]" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="mail-preview-heading text-sm font-semibold tracking-tight silver-text">
              STEALTH
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              mail protocol
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto rounded-md p-1.5 text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={onCompose}
        className={cn(
          "group mt-3 flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium",
          "border border-white/10 bg-white/5 text-foreground",
          "shadow-[0_8px_30px_-10px_rgba(0,0,0,0.6)] transition hover:bg-white/10",
          collapsed && "justify-center px-2",
        )}
      >
        <Pencil className="h-4 w-4" />
        {!collapsed && <span className="mail-preview-heading">Compose</span>}
        {!collapsed && (
          <span className="ml-auto rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Ctrl+N
          </span>
        )}
      </motion.button>

      <nav className="scrollbar-thin mt-4 flex-1 overflow-y-auto pr-1">
        {sections.map((section, sectionIndex) => (
          <div key={section.title ?? "mail"} className={sectionIndex === 0 ? "" : "mt-5"}>
            {section.title && !collapsed && (
              <div className="mail-preview-heading mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {section.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((it) => (
                <li key={it.key}>
                  <FolderButton
                    item={it}
                    count={counts[it.key]}
                    active={active === it.key}
                    collapsed={collapsed}
                    onSelect={() => onSelect(it.key)}
                    onDrop={
                      DROP_TARGET_FOLDERS.includes(it.key as import("./data").MailLocation)
                        ? (ids) => onDrop?.(ids, it.key)
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {!collapsed && (
          <>
            <div className="mt-6 mb-2 flex items-center justify-between px-3">
              <span className="mail-preview-heading text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Folders
              </span>
              <button
                onClick={() => setIsAddingFolder(true)}
                className="rounded p-1 text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Add folder input */}
            <AnimatePresence>
              {isAddingFolder && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 overflow-hidden px-3"
                >
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      ref={inputRef}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddFolder();
                        if (e.key === "Escape") {
                          setIsAddingFolder(false);
                          setNewFolderName("");
                        }
                      }}
                      placeholder="Folder name"
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        setIsAddingFolder(false);
                        setNewFolderName("");
                      }}
                      className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <ul className="space-y-0.5">
              {folders.map((f) => {
                const isCustomActive = customFolder === f.name;
                return (
                  <li key={f.name}>
                    <button
                      onClick={() => onSelectCustomFolder?.(isCustomActive ? null : f.name)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-white/[0.04] hover:text-foreground",
                        isCustomActive
                          ? "bg-white/[0.06] text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      <Hash className="h-3.5 w-3.5" style={{ color: f.color }} />
                      <span className="mail-preview-heading">{f.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      <div
        className={cn(
          "mt-3 flex items-center gap-3 rounded-md border border-white/5 bg-white/[0.03] p-2",
          collapsed && "justify-center",
        )}
      >
        <div
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full"
          style={{ background: "linear-gradient(135deg, #4d5560, #232326)" }}
        >
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white/90">
            EN
          </span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-xs font-medium text-foreground">Uthaimin</div>
            <div className="truncate text-[11px] text-muted-foreground">kryputh@stealth.me</div>
          </div>
        )}
        {!collapsed && (
          <span className="pulse-dot ml-auto h-1.5 w-1.5 rounded-full bg-[oklch(0.85_0.005_270)]" />
        )}
      </div>
    </motion.aside>
  );
}

function FolderButton({
  item,
  count,
  active,
  collapsed,
  onSelect,
  onDrop,
}: {
  item: SidebarItem;
  count?: number;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onDrop?: (emailIds: string[]) => void;
}) {
  const Icon = item.icon;
  const [isOver, setIsOver] = useState(false);

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      onDragOver={
        onDrop
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setIsOver(true);
            }
          : undefined
      }
      onDragLeave={onDrop ? () => setIsOver(false) : undefined}
      onDrop={
        onDrop
          ? (e) => {
              e.preventDefault();
              setIsOver(false);
              try {
                const ids: string[] = JSON.parse(e.dataTransfer.getData("text/plain"));
                if (Array.isArray(ids) && ids.length > 0) onDrop(ids);
              } catch {
                /* ignore */
              }
            }
          : undefined
      }
      className={cn(
        "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
        "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        active && "text-foreground",
        collapsed && "justify-center px-2",
        isOver && "bg-white/[0.08] ring-1 ring-white/20 text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-lg"
          style={{
            background: "linear-gradient(180deg, oklch(1 0 0 / 0.06), oklch(1 0 0 / 0.02))",
            boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.08)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <Icon className="relative h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="mail-preview-heading relative truncate">{item.label}</span>
          {count !== undefined && count > 0 && (
            <span className="relative ml-auto text-[11px] tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </>
      )}
    </motion.button>
  );
}
