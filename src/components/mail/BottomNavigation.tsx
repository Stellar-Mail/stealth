import { motion } from "framer-motion";
import {
  Pencil,
  Search,
  Inbox,
  Calendar,
  ReceiptText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MailFolder } from "./data";
import {
  BOTTOM_NAV_ITEMS,
  isBottomNavItemActive,
  type BottomNavItemId,
} from "./bottom-navigation-items";

interface BottomNavigationProps {
  active: MailFolder;
  onCompose: () => void;
  onOpenPalette: () => void;
  onOpenCalendar: () => void;
  onOpenSettings: () => void;
  onSelectFolder: (folder: MailFolder) => void;
}

const ICONS: Record<BottomNavItemId, LucideIcon> = {
  compose: Pencil,
  search: Search,
  inbox: Inbox,
  calendar: Calendar,
  proofs: ReceiptText,
  settings: Settings,
};

export function BottomNavigation({
  active,
  onCompose,
  onOpenPalette,
  onOpenCalendar,
  onOpenSettings,
  onSelectFolder,
}: BottomNavigationProps) {
  const handlers: Record<BottomNavItemId, () => void> = {
    compose: onCompose,
    search: onOpenPalette,
    inbox: () => onSelectFolder("inbox"),
    calendar: onOpenCalendar,
    proofs: () => onSelectFolder("pending"),
    settings: onOpenSettings,
  };

  return (
    <nav
      aria-label="Bottom navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/10 safe-area-inset-bottom"
    >
      <div className="flex items-center justify-around py-2 px-1">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.id];
          const isActive = isBottomNavItemActive(item, active);
          return (
            <button
              key={item.id}
              onClick={handlers[item.id]}
              className="glow-ring relative flex flex-col items-center justify-center rounded-lg px-2 py-1.5 transition-all hover:bg-white/[0.04] active:scale-[0.96]"
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative z-10 flex flex-col items-center gap-0.5">
                <Icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </div>
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 rounded-lg bg-white/5"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
