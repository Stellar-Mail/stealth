import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ADMIN_EMPTY_STATE_PRESETS } from "../constants/adminEmptyStates";

export interface AdminEmptyStateProps {
  /** Optional preset that supplies default title/description copy. */
  kind?: keyof typeof ADMIN_EMPTY_STATE_PRESETS;
  /** Heading. Falls back to the preset title when omitted. */
  title?: string;
  /** Supporting text. Falls back to the preset description when omitted. */
  description?: string;
  /** Optional leading icon or illustration. */
  icon?: ReactNode;
  /** Optional call-to-action slot rendered below the copy. */
  action?: ReactNode;
  /** Additional class names for the wrapper. */
  className?: string;
}

/**
 * Friendly, reusable empty state for the demo admin panels. Pass a `kind` to use
 * the preset copy (messages, senders, attachments, events, validation), or
 * provide your own title/description. The `action` prop is the CTA slot.
 */
export function AdminEmptyState({
  kind,
  title,
  description,
  icon,
  action,
  className,
}: AdminEmptyStateProps) {
  const preset = kind ? ADMIN_EMPTY_STATE_PRESETS[kind] : undefined;
  const resolvedTitle = title ?? preset?.title ?? "Nothing here yet";
  const resolvedDescription = description ?? preset?.description;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center",
        className,
      )}
      role="status"
    >
      {icon}
      <p className="text-sm font-semibold text-foreground">{resolvedTitle}</p>
      {resolvedDescription ? (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{resolvedDescription}</p>
      ) : null}
      {action}
    </div>
  );
}
