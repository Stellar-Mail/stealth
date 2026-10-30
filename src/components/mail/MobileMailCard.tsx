import { Archive, Clock, Flag, Paperclip, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Email } from "./data";
import { EmailTrustBadges } from "./EmailTrustBadges";
import { SenderAvatar } from "./SenderAvatar";

type MobileMailCardProps = {
  email: Email;
  selected: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  onStar?: () => void;
  onSnooze?: () => void;
  criticalWarning?: string | null;
};

export function MobileMailCard({
  email,
  selected,
  onSelect,
  onArchive,
  onStar,
  onSnooze,
  criticalWarning,
}: MobileMailCardProps) {
  return (
    <div
      className={cn(
        "mobile-mail-preview-card relative overflow-hidden rounded-xl border",
        selected && "mobile-mail-preview-card--active",
        selected
          ? "border-surface-tint/20 bg-preview-active shadow-[0_18px_42px_oklch(0_0_0/0.35),0_0_0_1px_oklch(1_0_0/0.07),inset_0_1px_0_oklch(1_0_0/0.14)]"
          : "border-surface-tint/8 bg-preview hover:border-surface-tint/12 hover:bg-preview-hover",
      )}
    >
      {/* Ambient glow overlay */}
      <div
        aria-hidden="true"
        className={cn(
          "mobile-card-highlight pointer-events-none absolute inset-0",
          selected ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Main card content */}
      <button
        type="button"
        data-email-id={email.id}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className="mail-card-press relative w-full px-3 py-2.5 text-left"
        style={{ minWidth: 0 }}
      >
        {/* Header row: avatar, sender, time */}
        <div className="flex items-start gap-2.5">
          {/* Avatar with unread indicator */}
          <div className="relative shrink-0">
            <SenderAvatar email={email} size="lg" unread={email.unread} />
          </div>

          {/* Sender and time */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    "truncate text-[13px] font-semibold leading-tight text-foreground/88",
                    email.unread && "text-foreground/94",
                  )}
                >
                  {email.from}
                </span>
                <EmailTrustBadges
                  email={email}
                  max={1}
                  size="sm"
                  showLabels={false}
                  className="shrink-0"
                />
                {criticalWarning && (
                  <Flag
                    role="img"
                    aria-label={`Critical warning: ${criticalWarning}`}
                    className="h-3.5 w-3.5 shrink-0 text-status-warning"
                  >
                    <title>{criticalWarning}</title>
                  </Flag>
                )}
              </div>
              <span className="shrink-0 text-[10.5px] font-medium leading-none tabular-nums text-muted-foreground/85">
                {email.time}
              </span>
            </div>

            {/* Protocol badge row */}
            {Boolean(email.labels?.length) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {email.labels?.slice(0, 2).map((label) => (
                  <Badge key={label} variant="secondary" className="h-4.5 px-1.5 text-[9px]">
                    {label}
                  </Badge>
                ))}
                {email.labels && email.labels.length > 2 && (
                  <span className="text-[9px] text-muted-foreground">
                    +{email.labels.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Subject with attachment indicator */}
        <div className="mt-2 flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "truncate text-[12px] font-medium leading-snug text-foreground/68",
                email.unread && "text-foreground/78",
              )}
            >
              {email.subject}
            </div>
            {/* Preview text */}
            <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground/70">
              {email.preview}
            </div>
          </div>
          {email.attachments && email.attachments.length > 0 && (
            <div className="flex shrink-0 items-center gap-1 rounded-md bg-surface-tint/5 px-1.5 py-0.5">
              <Paperclip className="h-3 w-3 text-muted-foreground/70" />
              <span className="text-[10px] font-medium text-muted-foreground/70">
                {email.attachments.length}
              </span>
            </div>
          )}
        </div>

        {/* Snooze indicator */}
        {email.snooze && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1">
            <Clock className="h-3 w-3 text-status-warning dark:text-amber-300" />
            <span className="text-[10px] text-status-warning/90 dark:text-amber-200/90">
              Snoozed until {email.snooze.label}
            </span>
          </div>
        )}
      </button>

      {/* Touch-friendly action bar */}
      <div className="flex border-t border-surface-tint/8 bg-surface-tint/[0.02]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStar?.();
          }}
          className="mail-card-press flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-muted-foreground hover:text-foreground active:bg-surface-tint/5"
          aria-label={email.starred ? "Unstar" : "Star"}
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              email.starred && "fill-amber-400 text-status-warning dark:text-amber-400",
            )}
          />
          <span className="text-[11px] font-medium">{email.starred ? "Starred" : "Star"}</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSnooze?.();
          }}
          className="mail-card-press flex flex-1 items-center justify-center gap-1.5 border-l border-surface-tint/8 px-3 py-2.5 text-muted-foreground hover:text-foreground active:bg-surface-tint/5"
          aria-label="Snooze"
        >
          <Clock className="h-4 w-4" />
          <span className="text-[11px] font-medium">Snooze</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArchive?.();
          }}
          className="mail-card-press flex flex-1 items-center justify-center gap-1.5 border-l border-surface-tint/8 px-3 py-2.5 text-muted-foreground hover:text-foreground active:bg-surface-tint/5"
          aria-label="Archive"
        >
          <Archive className="h-4 w-4" />
          <span className="text-[11px] font-medium">Archive</span>
        </button>
      </div>
    </div>
  );
}
