import { Archive, Clock, Paperclip, Star } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Email } from "./data";
import { isVerified, mailFolders } from "./data";
import { EmailTrustBadges } from "./EmailTrustBadges";

type MobileMailCardProps = {
  email: Email;
  selected: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  onStar?: () => void;
  onSnooze?: () => void;
};

export function MobileMailCard({
  email,
  selected,
  onSelect,
  onArchive,
  onStar,
  onSnooze,
}: MobileMailCardProps) {
  const folderInfo = mailFolders.find((f) => f.key === email.folder);
  const isProtocolFolder = folderInfo?.group === "protocol";
  const verified = isVerified(email);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all duration-300",
        selected
          ? "border-white/20 bg-[oklch(0.38_0.007_270/0.55)] shadow-[0_18px_42px_oklch(0_0_0/0.35),0_0_0_1px_oklch(1_0_0/0.07),inset_0_1px_0_oklch(1_0_0/0.14)]"
          : "border-white/8 bg-[oklch(0.3_0.006_270/0.42)] hover:border-white/12 hover:bg-[oklch(0.34_0.006_270/0.48)]",
      )}
    >
      {/* Ambient glow overlay */}
      {selected && (
        <motion.div
          layoutId="mobile-card-active"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 22%, oklch(1 0 0 / 0.12), transparent 36%), linear-gradient(135deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.025) 44%, oklch(1 0 0 / 0.01))",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}

      {/* Main card content */}
      <button
        onClick={onSelect}
        className="relative w-full px-3 py-2.5 text-left"
        style={{ minWidth: 0 }}
      >
        {/* Header row: avatar, sender, time */}
        <div className="flex items-start gap-2.5">
          {/* Avatar with unread indicator */}
          <div className="relative shrink-0">
            <div className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/15 shadow-[0_8px_18px_-12px_rgba(0,0,0,0.9)]">
              <img
                src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email.from)}&backgroundColor=1a1a1d`}
                alt={email.from}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            {email.unread && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[oklch(0.9_0.005_270)] ring-2 ring-[oklch(0.18_0.005_270)]" />
            )}
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
              </div>
              <span className="shrink-0 text-[10.5px] font-medium leading-none tabular-nums text-muted-foreground/85">
                {email.time}
              </span>
            </div>

            {/* Protocol badge row */}
            {(isProtocolFolder || verified || email.labels?.length) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {verified && (
                  <Badge
                    variant="outline"
                    className="h-4.5 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[9px] text-emerald-300"
                  >
                    Verified
                  </Badge>
                )}
                {isProtocolFolder && folderInfo && (
                  <Badge
                    variant="outline"
                    className="h-4.5 border-blue-500/30 bg-blue-500/10 px-1.5 text-[9px] text-blue-300"
                  >
                    {folderInfo.label}
                  </Badge>
                )}
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
            <div className="flex shrink-0 items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5">
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
            <Clock className="h-3 w-3 text-amber-300" />
            <span className="text-[10px] text-amber-200/90">
              Snoozed until {email.snooze.label}
            </span>
          </div>
        )}
      </button>

      {/* Touch-friendly action bar */}
      <div className="flex border-t border-white/8 bg-white/[0.02]">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onStar?.();
          }}
          className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-muted-foreground transition-colors hover:text-foreground active:bg-white/5"
          aria-label={email.starred ? "Unstar" : "Star"}
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              email.starred && "fill-amber-400 text-amber-400",
            )}
          />
          <span className="text-[11px] font-medium">{email.starred ? "Starred" : "Star"}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onSnooze?.();
          }}
          className="flex flex-1 items-center justify-center gap-1.5 border-l border-white/8 px-3 py-2.5 text-muted-foreground transition-colors hover:text-foreground active:bg-white/5"
          aria-label="Snooze"
        >
          <Clock className="h-4 w-4" />
          <span className="text-[11px] font-medium">Snooze</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onArchive?.();
          }}
          className="flex flex-1 items-center justify-center gap-1.5 border-l border-white/8 px-3 py-2.5 text-muted-foreground transition-colors hover:text-foreground active:bg-white/5"
          aria-label="Archive"
        >
          <Archive className="h-4 w-4" />
          <span className="text-[11px] font-medium">Archive</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
