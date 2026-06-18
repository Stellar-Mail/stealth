import { motion } from "framer-motion";
import { Pencil, Search, Inbox, Calendar, ReceiptText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MailFolder } from "./data";

interface BottomNavigationProps {
  active: MailFolder;
  onCompose: () => void;
  onOpenPalette: () => void;
  onOpenCalendar: () => void;
  onOpenSettings: () => void;
  onSelectFolder: (folder: MailFolder) => void;
}

export function BottomNavigation({
  active,
  onCompose,
  onOpenPalette,
  onOpenCalendar,
  onOpenSettings,
  onSelectFolder,
}: BottomNavigationProps) {
  const items = [
    {
      id: "compose",
      icon: Pencil,
      label: "Compose",
      onClick: onCompose,
      isActive: false,
    },
    {
      id: "search",
      icon: Search,
      label: "Search",
      onClick: onOpenPalette,
      isActive: false,
    },
    {
      id: "inbox",
      icon: Inbox,
      label: "Inbox",
      onClick: () => onSelectFolder("inbox"),
      isActive: active === "inbox",
    },
    {
      id: "calendar",
      icon: Calendar,
      label: "Calendar",
      onClick: onOpenCalendar,
      isActive: false,
    },
    {
      id: "proofs",
      icon: ReceiptText,
      label: "Proofs",
      onClick: () => onSelectFolder("pending"),
      isActive: active === "pending",
    },
    {
      id: "settings",
      icon: Settings,
      label: "Settings",
      onClick: onOpenSettings,
      isActive: false,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/10 safe-area-inset-bottom">
      <div className="flex items-center justify-around py-2 px-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className="relative flex flex-col items-center justify-center px-2 py-1.5 rounded-lg transition-all"
              aria-label={item.label}
            >
              <div className="relative z-10 flex flex-col items-center gap-0.5">
                <Icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    item.isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    item.isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </div>
              {item.isActive && (
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
