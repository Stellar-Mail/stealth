import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  BriefcaseBusiness,
  Keyboard,
  LogOut,
  Paperclip,
  RefreshCw,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";
import {
  NotificationsIcon as Bell,
  CalendarIcon as Calendar,
  FilterIcon as Filter,
  SettingsIcon as Settings,
  ImportIcon as Upload,
  IdentityIcon as User,
} from "@/features/design-system/components/mail-icons";
import { cn } from "@/lib/utils";
import { NotificationsPanel } from "./NotificationsPanel";
import { TopbarSearch } from "./TopbarSearch";
import { type MailFilters, type Email } from "./data";
import type { InAppNotification } from "@/features/notifications";
import "@/features/work/work.css";

/**
 * Shared keyboard + focus behavior for the topbar popovers.
 *
 * - Announces the expanded state on the trigger (`aria-expanded`).
 * - Moves focus into the popover panel on open.
 * - Closes on Escape and returns focus to the trigger.
 * - Restores focus to the trigger when the popover closes while focus is
 *   still inside it (Escape / click-outside), but never steals focus from an
 *   action the user already activated (e.g. a menu item that opened a dialog).
 */
function usePopoverFocus(
  open: boolean,
  onClose: () => void,
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>,
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const ownTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = returnFocusRef ?? ownTriggerRef;

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables && focusables.length > 0) focusables[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const active = document.activeElement;
      const panel = panelRef.current;
      if (panel && active && panel.contains(active)) {
        triggerRef.current?.focus();
      }
    };
  }, [open, onClose, triggerRef]);

  return { panelRef, triggerRef };
}

type TopbarProps = {
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onOpenProofInspector: () => void;
  onImportContacts: () => void;
  onShowToast: (message: string) => void;
  onOpenShortcuts: () => void;
  filters: MailFilters;
  onFiltersChange: (filters: MailFilters) => void;
  onViewNotifications: () => void;
  onSignOut?: () => void;
  onOpenLogin?: () => void;
  notifications: InAppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  actor?: string | null;
  emails?: Email[];
  onSelectEmail?: (emailId: string, folder?: string) => void;
  onSelectContact?: (address: string) => void;
  workActive?: boolean;
  onToggleWork?: () => void;
};

export function Topbar({
  onOpenPalette,
  onOpenSettings,
  onOpenProofInspector,
  onImportContacts,
  onShowToast,
  onOpenShortcuts,
  filters,
  onFiltersChange,
  onViewNotifications,
  onSignOut,
  onOpenLogin,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  actor,
  emails,
  onSelectEmail,
  onSelectContact,
  workActive = false,
  onToggleWork,
}: TopbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [account, setAccount] = useState<"personal" | "protocol">("personal");

  const accountRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const [filterRect, setFilterRect] = useState<DOMRect | null>(null);
  const [accountRect, setAccountRect] = useState<DOMRect | null>(null);
  const [notifRect, setNotifRect] = useState<DOMRect | null>(null);

  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const closeFilter = useCallback(() => setFilterOpen(false), []);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
  const accountPopover = usePopoverFocus(accountOpen, closeAccount);
  const filterPopover = usePopoverFocus(filterOpen, closeFilter, accountPopover.triggerRef);
  const notificationsPopover = usePopoverFocus(notificationsOpen, closeNotifications);

  useLayoutEffect(() => {
    if (filterOpen && accountRef.current) setFilterRect(accountRef.current.getBoundingClientRect());
  }, [filterOpen]);
  useLayoutEffect(() => {
    if (accountOpen && accountRef.current)
      setAccountRect(accountRef.current.getBoundingClientRect());
  }, [accountOpen]);
  useLayoutEffect(() => {
    if (notificationsOpen && notificationsRef.current)
      setNotifRect(notificationsRef.current.getBoundingClientRect());
  }, [notificationsOpen]);

  useEffect(() => {
    // Only subscribe to global scroll/resize while a dropdown is actually open.
    // The scroll listener uses capture, so without this gate it would fire on
    // every scroll anywhere in the app (e.g. the email list and reader panes)
    // even when there is no open panel to reposition.
    const anyOpen = filterOpen || accountOpen || notificationsOpen;
    if (!anyOpen) return;

    const onReposition = () => {
      if (filterOpen && accountRef.current)
        setFilterRect(accountRef.current.getBoundingClientRect());
      if (accountOpen && accountRef.current)
        setAccountRect(accountRef.current.getBoundingClientRect());
      if (notificationsOpen && notificationsRef.current)
        setNotifRect(notificationsRef.current.getBoundingClientRect());
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [filterOpen, accountOpen, notificationsOpen]);

  return (
    <header className="glass mail-topbar relative z-50 m-0 flex h-12 shrink-0 items-center gap-3 overflow-hidden rounded-none border-t-0 pl-3">
      <TopbarSearch
        actor={actor}
        emails={emails}
        onOpenPalette={onOpenPalette}
        onSelectEmail={onSelectEmail}
        onSelectContact={onSelectContact}
      />

      <div className="glass-tile mail-account-controls ml-auto flex shrink-0 items-center overflow-hidden rounded-l-[7px] rounded-r-none border-r-0">
        {onToggleWork && (
          <button
            type="button"
            aria-label="Work"
            aria-pressed={workActive}
            title={workActive ? "Return to Personal mail" : "Open Stealth Work"}
            className="work-switch mail-mode-control glow-ring"
            onClick={onToggleWork}
          >
            <span>Work</span>
            <BriefcaseBusiness className="h-4 w-4" />
          </button>
        )}
        {onToggleWork && <span aria-hidden="true" className="mail-control-divider" />}
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
                    className="fixed inset-0 z-[100] bg-overlay/40 backdrop-blur-xl"
                  />
                  <motion.div
                    ref={filterPopover.panelRef}
                    role="dialog"
                    aria-label="Filters"
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

                    <div className="my-2 border-t border-surface-tint/5" />

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
                            ? "bg-surface-tint/[0.08] text-foreground"
                            : "text-muted-foreground hover:bg-surface-tint/[0.04] hover:text-foreground",
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
                        <div className="my-2 border-t border-surface-tint/5" />
                        <button
                          onClick={() =>
                            onFiltersChange({
                              unreadOnly: false,
                              hasAttachments: false,
                              dateRange: "all",
                            })
                          }
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-surface-tint/[0.04] hover:text-foreground"
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
            className="mail-notifications-control"
            buttonRef={notificationsPopover.triggerRef}
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            active={notificationsOpen}
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
          >
            <span className="relative">
              <Bell className="h-4 w-4" />
              <span className="pulse-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-silver" />
            </span>
          </IconBtn>
        </div>
        <NotificationsPanel
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          anchorRect={notifRect}
          panelRef={notificationsPopover.panelRef}
          onViewAll={onViewNotifications}
          notifications={notifications}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
        />

        <span aria-hidden="true" className="mail-control-divider" />

        {/* Account menu */}
        <div ref={accountRef} className="relative">
          <button
            ref={accountPopover.triggerRef}
            onClick={() => setAccountOpen(!accountOpen)}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            aria-label="Account menu"
            className={cn(
              "glow-ring mail-account-control flex h-9 items-center gap-2 px-2.5 text-xs text-foreground transition hover:bg-surface-tint/[0.08]",
              accountOpen && "bg-surface-tint/[0.08]",
            )}
          >
            <span className="hidden sm:inline">{account === "personal" ? "Mail" : "Team"}</span>
            <img
              src="/avatars/personal.svg"
              alt=""
              className="h-5 w-5 shrink-0 rounded-full object-cover"
            />
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
                    aria-hidden="true"
                    className="fixed inset-0 z-[100] bg-surface-recessed/40 backdrop-blur-xl"
                  />
                  <motion.div
                    ref={accountPopover.panelRef}
                    role="menu"
                    aria-label="Account"
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
                    <div className="border-b border-surface-tint/5 p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src="/avatars/personal.svg"
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
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
                        icon={Settings}
                        label="Settings"
                        onClick={() => {
                          setAccountOpen(false);
                          onOpenSettings();
                        }}
                      />
                      <AccountMenuItem
                        icon={Filter}
                        label="Filter"
                        onClick={() => {
                          setAccountOpen(false);
                          setFilterOpen(true);
                        }}
                      />
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
                            `Switched to ${
                              account === "personal" ? "Protocol" : "Personal"
                            } mailbox`,
                          );
                        }}
                      />
                      <AccountMenuItem
                        icon={User}
                        label="Sign in with password"
                        onClick={() => {
                          setAccountOpen(false);
                          onOpenLogin?.();
                        }}
                      />
                      <div className="my-1 border-t border-surface-tint/5" />
                      <AccountMenuItem
                        icon={Upload}
                        label="Import contacts"
                        onClick={() => {
                          setAccountOpen(false);
                          onImportContacts();
                        }}
                      />
                      <AccountMenuItem
                        icon={ScanSearch}
                        label="Proof Inspector"
                        onClick={() => {
                          setAccountOpen(false);
                          onOpenProofInspector();
                        }}
                      />
                      <AccountMenuItem
                        icon={ScanSearch}
                        label="Command palette"
                        onClick={() => {
                          setAccountOpen(false);
                          onOpenPalette();
                        }}
                      />
                      <AccountMenuItem
                        icon={Keyboard}
                        label="Keyboard shortcuts"
                        onClick={() => {
                          setAccountOpen(false);
                          onOpenShortcuts();
                        }}
                      />
                      <div className="my-1 border-t border-surface-tint/5" />
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
    </header>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  active,
  buttonRef,
  className,
  ...rest
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  className?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "dialog" | "menu" | undefined;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      ref={buttonRef}
      aria-label={label}
      title={label}
      onClick={onClick}
      {...rest}
      className={cn(
        "glow-ring rounded-[6px] p-2 text-icon transition hover:bg-surface-tint/[0.06] hover:text-foreground",
        "inline-flex items-center justify-center gap-1.5 min-h-[36px] min-w-[36px]",
        active && "bg-surface-tint/[0.06] text-foreground",
        className,
      )}
    >
      {children}
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
          ? "bg-surface-tint/[0.08] text-foreground"
          : "text-muted-foreground hover:bg-surface-tint/[0.04] hover:text-foreground",
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
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface-tint/[0.06] hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
