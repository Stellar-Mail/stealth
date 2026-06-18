import { motion } from "framer-motion";
import { Calendar, Inbox, Pencil, Search, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MailFolder } from "./data";

type NavItem = {
  id: string;
  label: string;
  icon: typeof Inbox;
  folder?: MailFolder;
};

const navItems: NavItem[] = [
  { id: "inbox", label: "Inbox", icon: Inbox, folder: "inbox" },
  { id: "search", label: "Search", icon: Search },
  { id: "compose", label: "Compose", icon: Pencil },
  { id: "proofs", label: "Proofs", icon: ShieldCheck, folder: "verified" },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "settings", label: "Settings", icon: Settings },
];

export interface BottomNavProps {
  activeFolder: MailFolder;
  onCompose: () => void;
  onOpenPalette: () => void;
  onOpenCalendar: () => void;
  onOpenSettings: () => void;
  onSelectFolder: (folder: MailFolder) => void;
}

export function BottomNav({
  activeFolder,
  onCompose,
  onOpenPalette,
  onOpenCalendar,
  onOpenSettings,
  onSelectFolder,
}: BottomNavProps) {
  function handlePress(item: NavItem) {
    if (item.id === "compose") {
      onCompose();
      return;
    }
    if (item.id === "search") {
      onOpenPalette();
      return;
    }
    if (item.id === "calendar") {
      onOpenCalendar();
      return;
    }
    if (item.id === "settings") {
      onOpenSettings();
      return;
    }
    if (item.folder) onSelectFolder(item.folder);
  }

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 md:hidden",
        "glass border-t border-white/10",
        "pb-[env(safe-area-inset-bottom,0px)]",
      )}
    >
      <ul className="flex items-center justify-around px-1 pt-1 pb-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.folder ? activeFolder === item.folder : false;
          return (
            <li key={item.id} className="flex-1">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => handlePress(item)}
                className={cn(
                  "relative flex w-full flex-col items-center gap-0.5 rounded-xl py-1.5",
                  "text-[10px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
                )}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-indicator"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background:
                        "linear-gradient(180deg, oklch(1 0 0 / 0.07), oklch(1 0 0 / 0.03))",
                      boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.09)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon aria-hidden className="relative h-5 w-5" />
                <span className="relative leading-none">{item.label}</span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
