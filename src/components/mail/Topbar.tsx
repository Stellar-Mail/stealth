import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Calendar,
  Check,
  CircleHelp,
  Clock3,
  Command,
  Filter,
  LogOut,
  Paperclip,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsPanel } from "./NotificationsPanel";
import type { MailFilters } from "./data";

type TopbarProps = {
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onOpenProofInspector: () => void;
  onImportContacts: () => void;
  onShowToast: (message: string) => void;
  onOpenShortcuts: () => void;
  filters: MailFilters;
  onFiltersChange: (filters: MailFilters) => void;
  onQuickAction: (action: "proofs" | "later" | "files") => void;
  onViewNotifications: () => void;
  onSignOut?: () => void;
};

const quickActions: {
  label: string;
  value: string;
  action: "proofs" | "later" | "files";
  icon: LucideIcon;
}[] = [
  { label: "Proofs", value: "2", action: "proofs", icon: ShieldCheck },
  { label: "Later", value: "5", action: "later", icon: Clock3 },
  { label: "Files", value: "9", action: "files", icon: Paperclip },
];

export function Topbar({
  onOpenPalette,
  onOpenSettings,
  onOpenProofInspector,
  onImportContacts,
  onShowToast,
  onOpenShortcuts,
  filters,
  onFiltersChange,
  onQuickAction,
  onViewNotifications,
  onSignOut,
}: TopbarProps) {
  const [focused, setFocused] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [account, setAccount] = useState<"personal" | "protocol">("personal");

  const filterRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const [filterRect, setFilterRect] = useState<DOMRect | null>(null);
  const [accountRect, setAccountRect] = useState<DOMRect | null>(null);
  const [helpRect, setHelpRect] = useState<DOMRect | null>(null);
  const [notifRect, setNotifRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (filterOpen && filterRef.current) setFilterRect(filterRef.current.getBoundingClientRect());
  }, [filterOpen]);
  useLayoutEffect(() => {
    if (accountOpen && accountRef.current)
      setAccountRect(accountRef.current.getBoundingClientRect());
  }, [accountOpen]);
  useLayoutEffect(() => {
    if (helpOpen && helpRef.current) setHelpRect(helpRef.current.getBoundingClientRect());
  }, [helpOpen]);
  useLayoutEffect(() => {
    if (notificationsOpen && notificationsRef.current)
      setNotifRect(notificationsRef.current.getBoundingClientRect());
  }, [notificationsOpen]);

  useEffect(() => {
    const onResize = () => {
      if (filterOpen && filterRef.current) setFilterRect(filterRef.current.getBoundingClientRect());
      if (accountOpen && accountRef.current)
        setAccountRect(accountRef.current.getBoundingClientRect());
      if (helpOpen && helpRef.current) setHelpRect(helpRef.current.getBoundingClientRect());
      if (notificationsOpen && notificationsRef.current)
        setNotifRect(notificationsRef.current.getBoundingClientRect());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [filterOpen, accountOpen, helpOpen, notificationsOpen]);

  return (
    <header className="glass relative z-50 m-0 flex h-14 items-center gap-2 overflow-hidden rounded-none border-t-0 px-3">
      <motion.div className="relative flex h-9 min-w-[220px] flex-[1_1_320px] items-center lg:max-w-[430px]">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={onOpenPalette}
          placeholder="Search messages, people, proofs, attachments..."
          className="glow-ring h-9 w-full min-w-0 rounded-md border border-white/[0.07] bg-white/[0.035] pl-9 pr-14 text-[13px] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] placeholder:text-muted-foreground/70 transition focus:bg-white/[0.06]"
        />
        <button
          onClick={onOpenPalette}
          className="absolute right-1.5 flex items-center gap-1 rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          <Command className="h-3 w-3" /> K
        </button>
      </motion.div>

      <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
        {quickActions.map((action) => (
          <QuickAction
            key={action.label}
            {...action}
            onClick={() => onQuickAction(action.action)}
          />
        ))}
      </div>

      <div className="glass-tile ml-auto flex shrink-0 items-center gap-1 rounded-[8px] px-1">
        {/* Filter dropdown */}
        <div ref={filterRef} className="relative">
          <IconBtn
            label="Filter"
            onClick={() => setFilterOpen(!filterOpen)}
            active={
              filterOpen ||
              filters.unreadOnly ||
              filters.hasAttachments ||
              filters.dateRange !== "all"
            }
          >
            <Filter className="h-4 w-4" />
          </IconBtn>
        </div>
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {filterOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setFilterOpen(false)}
                    className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    style={{
                      position: "fixed",
                      top: filterRect ? filterRect.bottom + 8 : 64,
                      right: filterRect ? Math.max(8, window.innerWidth - filterRect.right) : 12,
                      width: 224,
                      zIndex: 110,
                    }}
                    className="glass-modal overflow-hidden rounded-xl p-2"
                  >
                    <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Filters
                    </div>

                    <FilterToggle
                      icon={Check}
                      label="Unread only"
                      checked={filters.unreadOnly}
                      onChange={(v) => onFiltersChange({ ...filters, unreadOnly: v })}
                    />
                    <FilterToggle
                      icon={Paperclip}
                      label="Has attachments"
                      checked={filters.hasAttachments}
                      onChange={(v) => onFiltersChange({ ...filters, hasAttachments: v })}
                    />

                    <div className="my-2 border-t border-white/5" />

                    <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Date range
                    </div>

                    {(["all", "today", "week", "month"] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => onFiltersChange({ ...filters, dateRange: range })}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition",
                          filters.dateRange === range
                            ? "bg-white/[0.08] text-foreground"
                            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                        )}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="capitalize">
                          {range === "all"
                            ? "All time"
                            : range === "week"
                              ? "This week"
                              : range === "month"
                                ? "This month"
                                : "Today"}
                        </span>
                      </button>
                    ))}

                    {(filters.unreadOnly ||
                      filters.hasAttachments ||
                      filters.dateRange !== "all") && (
                      <>
                        <div className="my-2 border-t border-white/5" />
                        <button
                          onClick={() =>
                            onFiltersChange({
                              unreadOnly: false,
                              hasAttachments: false,
                              dateRange: "all",
                            })
                          }
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Clear filters
                        </button>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body,
          )}

        {/* Notifications */}
        <div ref={notificationsRef} className="relative">
          <IconBtn
            label="Notifications"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            active={notificationsOpen}
          >
            <span className="relative">
              <Bell className="h-4 w-4" />
              <span className="pulse-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[oklch(0.85_0.005_270)]" />
            </span>
          </IconBtn>
        </div>
        <NotificationsPanel
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          anchorRect={notifRect}
          onViewAll={onViewNotifications}
        />

        {/* Import contacts */}
        <IconBtn label="Import contacts" onClick={onImportContacts}>
          <Upload className="h-4 w-4" />
        </IconBtn>

        <div ref={helpRef} className="relative">
          <IconBtn
            label="Help"
            onClick={() => setHelpOpen((open) => !open)}
            active={helpOpen}
            hint="?"
          >
            <CircleHelp className="h-4 w-4" />
          </IconBtn>
        </div>
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {helpOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setHelpOpen(false)}
                    className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    style={{
                      position: "fixed",
                      top: helpRect ? helpRect.bottom + 8 : 64,
                      right: helpRect ? Math.max(8, window.innerWidth - helpRect.right) : 12,
                      width: 260,
                      zIndex: 110,
                    }}
                    className="glass-modal overflow-hidden rounded-xl p-1.5"
                  >
                    <button
                      onClick={() => {
                        setHelpOpen(false);
                        onOpenShortcuts();
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                    >
                      <CircleHelp className="h-4 w-4" />
                      <span className="flex-1">Keyboard shortcuts</span>
                      <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px]">
                        ?
                      </kbd>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body,
          )}

        {/* Proof Inspector */}
        <IconBtn label="Proof Inspector" onClick={onOpenProofInspector} hint="I">
          <ShieldCheck className="h-4 w-4" />
        </IconBtn>

        {/* Settings */}
        <IconBtn label="Settings" onClick={onOpenSettings} hint=",">
          <Settings className="h-4 w-4" />
        </IconBtn>

        <div className="mx-1 h-6 w-px bg-white/10" />

        {/* Account menu */}
        <div ref={accountRef} className="relative">
          <button
            onClick={() => setAccountOpen(!accountOpen)}
            className={cn(
              "flex items-center gap-2 rounded-[6px] border border-white/5 bg-white/[0.04] px-2 py-1.5 text-xs text-foreground transition hover:bg-white/[0.08]",
              accountOpen && "bg-white/[0.08]",
            )}
          >
            <span
              className="h-5 w-5 rounded-full"
              style={{ background: "linear-gradient(135deg,#7a8290,#2b2b31)" }}
            />
            <span className="hidden xl:inline">
              {account === "personal" ? "Personal" : "Protocol"}
            </span>
          </button>
        </div>
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {accountOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setAccountOpen(false)}
                    className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    style={{
                      position: "fixed",
                      top: accountRect ? accountRect.bottom + 8 : 64,
                      right: accountRect ? Math.max(8, window.innerWidth - accountRect.right) : 12,
                      width: 224,
                      zIndex: 110,
                    }}
                    className="glass-modal overflow-hidden rounded-xl"
                  >
                    {/* Account info */}
                    <div className="border-b border-white/5 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#4d5560] to-[#232326] flex items-center justify-center">
                          <span className="text-sm font-medium text-white/90">EN</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {account === "personal" ? "Eve Navarro" : "Stealth Protocol"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {account === "personal" ? "eve*stealth.xyz" : "team*stealth.network"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="p-1">
                      <AccountMenuItem
                        icon={User}
                        label="Profile"
                        onClick={() => {
                          setAccountOpen(false);
                          onOpenSettings();
                        }}
                      />
                      <AccountMenuItem
                        icon={RefreshCw}
                        label="Switch account"
                        onClick={() => {
                          setAccountOpen(false);
                          setAccount((current) =>
                            current === "personal" ? "protocol" : "personal",
                          );
                          onShowToast(
                            `Switched to ${account === "personal" ? "Protocol" : "Personal"} mailbox`,
                          );
                        }}
                      />
                      <div className="my-1 border-t border-white/5" />
                      <AccountMenuItem
                        icon={LogOut}
                        label="Sign out"
                        onClick={() => {
                          setAccountOpen(false);
                          onShowToast("Signed out successfully");
                          onSignOut?.();
                        }}
                      />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body,
          )}
      </div>

      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="pointer-events-none absolute left-3 top-full mt-2 px-1 text-[11px] text-muted-foreground"
          >
            Press <kbd className="rounded border border-white/10 bg-black/40 px-1">Ctrl+K</kbd> for
            the command palette
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  active,
  hint,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  hint?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded-[6px] p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground",
        "inline-flex items-center gap-1.5",
        active && "bg-white/[0.06] text-foreground",
      )}
    >
      {children}
      {hint && (
        <span className="hidden rounded border border-white/10 bg-black/30 px-1 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
          {hint}
        </span>
      )}
    </motion.button>
  );
}

function QuickAction({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      aria-label={label}
      onClick={onClick}
      className="group glass-tile flex h-9 items-center gap-2 rounded-[6px] px-2.5 text-xs text-muted-foreground transition hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden 2xl:inline">{label}</span>
      <span className="rounded-[4px] border border-white/[0.08] bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
        {value}
      </span>
    </motion.button>
  );
}

function FilterToggle({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition",
        checked
          ? "bg-white/[0.08] text-foreground"
          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      {checked && <Check className="ml-auto h-3.5 w-3.5" />}
    </button>
  );
}

function AccountMenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
