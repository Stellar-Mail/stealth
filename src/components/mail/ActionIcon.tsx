/**
 * ActionIcon
 *
 * Animated icon wrapper for archive, star, snooze, approve, block,
 * and copy-proof actions. Provides haptic-like visual feedback with
 * proper reduced-motion support.
 *
 * Usage:
 *   <ActionIcon type="star" active={email.starred} onClick={handleStar}>
 *     <Star className="h-4 w-4" />
 *   </ActionIcon>
 */

import { motion, AnimatePresence } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  actionMotions,
  iconSwap,
  starToggle,
  archiveIcon,
  snoozeIcon,
  approveIcon,
  blockIcon,
  copyProofIcon,
  successPulse,
} from "@/lib/action-motions";

export type ActionType =
  | "archive"
  | "star"
  | "unstar"
  | "snooze"
  | "approve"
  | "block"
  | "copy-proof"
  | "refund"
  | "generic";

export type ActionIconProps = {
  type: ActionType;
  /** Whether to show the "active" visual state (e.g., starred). */
  active?: boolean;
  /** Whether this action is pending confirmation. Shows a subtle pulse. */
  optimistic?: boolean;
  /** Whether to show rollback shake visual. */
  rollback?: boolean;
  onClick?: (e: import("react").MouseEvent) => void;
  children: import("react").ReactNode;
  className?: string;
  hint?: string;
  /** Tone variant for the action. */
  tone?: "default" | "danger" | "success";
};

/**
 * Returns the appropriate animation preset for the given action type.
 */
function getActionAnimation(type: ActionType, active?: boolean) {
  if (type === "star" && active) return starToggle(true);
  if (type === "unstar" || (type === "star" && active === false)) return starToggle(false);
  if (type === "archive") return archiveIcon();
  if (type === "snooze") return snoozeIcon();
  if (type === "approve") return approveIcon();
  if (type === "block") return blockIcon();
  if (type === "copy-proof") return copyProofIcon();
  return iconSwap();
}

export function ActionIcon({
  type,
  active = false,
  optimistic = false,
  rollback = false,
  onClick,
  children,
  className,
  hint,
  tone = "default",
}: ActionIconProps) {
  const animation = getActionAnimation(type, active);

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "glow-ring relative inline-flex items-center justify-center rounded-[6px] p-2 transition",
        tone === "danger" && !active
          ? "text-muted-foreground hover:bg-red-300/[0.08] hover:text-red-300"
          : tone === "danger" && active
            ? "bg-red-300/[0.1] text-red-300"
            : tone === "success" && active
              ? "bg-emerald-300/[0.1] text-emerald-300"
              : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        active && tone === "default" && "bg-white/[0.06] text-foreground",
        rollback && "text-red-400",
        className,
      )}
      title={hint}
    >
      {/* Action animation layer */}
      <motion.span
        key={type + String(active) + String(rollback)}
        initial={rollback ? actionMotions.rollback().initial : animation.initial}
        animate={
          rollback
            ? actionMotions.rollback().animate
            : optimistic
              ? [animation.animate, successPulse().animate].flat()
              : animation.animate
        }
        transition={animation.transition}
        className="flex items-center justify-center"
      >
        {children}
      </motion.span>

      {/* Optimistic loading indicator */}
      <AnimatePresence>
        {optimistic && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-blue-400"
          />
        )}
      </AnimatePresence>

      {/* Keyboard shortcut hint */}
      {hint && (
        <span className="ml-1 hidden rounded border border-white/10 bg-black/30 px-1 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
          {hint}
        </span>
      )}
    </motion.button>
  );
}

/**
 * ActionButton - a styled button with consistent action visuals.
 * Used in the reader toolbar and list actions.
 */
export function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "default",
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  active?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "border-red-300/20 bg-red-300/[0.08] text-red-100 hover:bg-red-300/[0.14]"
          : tone === "success"
            ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100 hover:bg-emerald-300/[0.14]"
            : active
              ? "border-white/15 bg-white/[0.08] text-foreground"
              : "border-white/10 bg-white/[0.04] text-foreground/90 hover:bg-white/[0.08]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
}

export default ActionIcon;