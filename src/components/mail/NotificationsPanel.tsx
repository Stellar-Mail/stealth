import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, AtSign, Bell, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: "email" | "mention" | "system";
  title: string;
  message: string;
  time: string;
  read: boolean;
};

const initialNotifications: Notification[] = [
  {
    id: "1",
    type: "email",
    title: "New message from Lina Park",
    message: "Q2 brand system — final direction",
    time: "2 min ago",
    read: false,
  },
  {
    id: "2",
    type: "mention",
    title: "Marcus mentioned you",
    message: "in Architecture review notes",
    time: "1 hour ago",
    read: false,
  },
  {
    id: "3",
    type: "system",
    title: "Sync complete",
    message: "All messages synced to the blockchain",
    time: "3 hours ago",
    read: true,
  },
  {
    id: "4",
    type: "email",
    title: "New message from Stripe",
    message: "Your monthly invoice is ready",
    time: "Yesterday",
    read: true,
  },
];

const icons = {
  email: Mail,
  mention: AtSign,
  system: Bell,
};

export function NotificationsPanel({
  open,
  onClose,
  anchorRect,
  onViewAll,
}: {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  onViewAll: () => void;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const panelWidth = 360;
  const top = anchorRect ? anchorRect.bottom + 8 : 64;
  const right = anchorRect ? Math.max(8, window.innerWidth - anchorRect.right) : 12;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            style={{
              position: "fixed",
              top,
              right,
              width: panelWidth,
              zIndex: 110,
            }}
            className="glass-modal overflow-hidden rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notifications list */}
            <ul className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.04]">
              {notifications.map((n) => {
                const Icon = icons[n.type];
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => markAsRead(n.id)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]",
                        !n.read && "bg-white/[0.02]",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          !n.read ? "bg-white/10" : "bg-white/5",
                        )}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              "truncate text-sm",
                              !n.read ? "font-medium text-foreground" : "text-foreground/80",
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[oklch(0.85_0.005_270)]" />
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground/70">{n.time}</p>
                      </div>
                      {n.read && <Check className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            <div className="border-t border-white/5 px-4 py-2">
              <button
                onClick={() => {
                  onClose();
                  onViewAll();
                }}
                className="w-full rounded-lg py-2 text-xs text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
              >
                View all notifications
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
