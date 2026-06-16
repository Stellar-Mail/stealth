import { useState } from "react";
import { motion } from "framer-motion";
import {
  applyMailFilters,
  getEmailsForFolder,
  getFolderLabel,
  type Email,
  type MailFilters,
  type MailFolder,
} from "./data";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "unread" | "flagged";

export function EmailList({
  emails,
  selectedId,
  onSelect,
  folder,
  filters,
  customFolder,
  compact,
  showAvatars,
}: {
  emails: Email[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  folder: MailFolder;
  filters: MailFilters;
  customFolder?: string | null;
  compact: boolean;
  showAvatars: boolean;
}) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const folderLabel = customFolder ?? getFolderLabel(folder);

  const folderEmails = customFolder
    ? emails.filter((email) =>
        email.labels?.some((label) => label.toLowerCase() === customFolder.toLowerCase()),
      )
    : getEmailsForFolder(emails, folder);

  const filtered = applyMailFilters(folderEmails, filters).filter((e: Email) => {
    if (activeTab === "unread") return e.unread;
    if (activeTab === "flagged") return e.starred;
    return true;
  });

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

      <ul className="scrollbar-thin relative z-10 flex-1 space-y-2 overflow-y-auto p-2.5">
        {filtered.length === 0 && (
          <li className="px-3 py-10 text-center text-xs text-muted-foreground">
            No conversations in {folderLabel.toLowerCase()} yet.
          </li>
        )}
        {filtered.map((e: Email, idx: number) => {
          const active = selectedId === e.id;
          return (
            <motion.li
              key={e.id}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02, duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <motion.button
                onClick={() => onSelect(e.id)}
                whileTap={{ scale: 0.975 }}
                transition={{ type: "spring", stiffness: 520, damping: 30 }}
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
                    <span
                      className={cn(
                        "mail-preview-heading truncate text-[13.5px] font-semibold leading-5 text-foreground/88",
                        e.unread && "text-foreground/94",
                      )}
                    >
                      {e.from}
                    </span>
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
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
