import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { FeedbackItem, FeedbackTone } from "./use-feedback";

const toneStyles: Record<FeedbackTone, string> = {
  neutral: "border-white/10 text-foreground",
  success: "border-emerald-300/20 text-emerald-100",
  warning: "border-amber-300/20 text-amber-100",
  danger: "border-red-300/20 text-red-100",
};

const toneIcons: Record<FeedbackTone, typeof Info> = {
  neutral: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
};

interface FeedbackViewportProps {
  items: FeedbackItem[];
  onDismiss: (id: string) => void;
}

export function FeedbackViewport({ items, onDismiss }: FeedbackViewportProps) {
  // Respect the OS reduced-motion setting: framer-motion's JS animations are
  // not covered by the CSS prefers-reduced-motion rule, so toasts fall back to
  // an instant opacity change with no slide, scale, spring, or layout shift.
  const reduceMotion = useReducedMotion();
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-5 z-[200] flex flex-col items-center gap-2"
    >
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const Icon = toneIcons[item.tone];

          return (
            <motion.div
              key={item.id}
              layout={!reduceMotion}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
              transition={
                reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 30 }
              }
              className={cn(
                "glass-strong pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)]",
                toneStyles[item.tone],
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 text-sm text-foreground">{item.message}</span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => onDismiss(item.id)}
                className="glow-ring rounded-lg p-1 text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export type { FeedbackViewportProps };
