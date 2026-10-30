import {
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare2,
  LayoutDashboard,
  Mail,
  MessageSquareText,
  Plus,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComposeButton } from "@/components/mail/ComposeButton";
import type { WorkView } from "./model";
import "./work.css";

export const workViews = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "mail", label: "Mail", icon: Mail },
  { id: "tasks", label: "Tasks", icon: CheckSquare2 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "notes", label: "Private notes", icon: MessageSquareText },
] as const;

export function WorkSidebar({
  active,
  onSelect,
  onCompose,
  onSettings,
}: {
  active: WorkView;
  onSelect: (view: WorkView) => void;
  onCompose: () => void;
  onSettings: () => void;
}) {
  return (
    <aside className="glass mail-sidebar hidden h-screen w-[240px] shrink-0 flex-col border-y-0 border-l-0 p-3 md:flex">
      <div className="flex items-center gap-3 px-2 py-2">
        <span className="work-brand">
          <BriefcaseBusiness className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Stealth Work</p>
          <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
            A quieter workspace
          </p>
        </div>
      </div>
      <ComposeButton onCompose={onCompose} />
      <nav aria-label="Work navigation" className="mt-5 space-y-1">
        {workViews.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            aria-current={active === id ? "page" : undefined}
            className={cn(
              "glow-ring flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition",
              active === id
                ? "border-border bg-surface-tint/[0.06] text-foreground"
                : "border-transparent text-muted-foreground hover:bg-surface-tint/[0.04] hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="mt-auto px-2 pb-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Work preview</p>
        <p className="mt-1">
          Tasks and notes stay in this session. They are not shared or sent as mail.
        </p>
      </div>
      <button
        onClick={onSettings}
        className="glow-ring flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-surface-tint/[0.04] hover:text-foreground"
      >
        <Settings2 className="h-4 w-4" />
        Workspace settings
      </button>
    </aside>
  );
}

export function WorkMobileNavigation({
  active,
  onSelect,
  onCompose,
}: {
  active: WorkView;
  onSelect: (view: WorkView) => void;
  onCompose: () => void;
}) {
  return (
    <nav
      aria-label="Work navigation"
      className="flex shrink-0 items-center justify-around border-b border-border px-2 py-2 md:hidden"
    >
      {workViews.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          aria-label={label}
          aria-current={active === id ? "page" : undefined}
          onClick={() => onSelect(id)}
          className={cn(
            "glow-ring flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[9px]",
            active === id ? "bg-surface-tint/[0.06] text-foreground" : "text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          {id === "notes" ? "Notes" : label}
        </button>
      ))}
      <button
        aria-label="Compose"
        onClick={onCompose}
        className="glow-ring flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[9px] text-muted-foreground"
      >
        <Plus className="h-4 w-4" />
        Compose
      </button>
    </nav>
  );
}
