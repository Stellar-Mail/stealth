import { cn } from "@/lib/utils";
import type { SenderPolicy } from "@/components/mail/data";
import { getSenderPolicyOption } from "./types";

const toneClasses: Record<SenderPolicy, string> = {
  allow: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  verify: "border-sky-300/25 bg-sky-300/10 text-sky-200",
  block: "border-red-300/25 bg-red-300/10 text-red-200",
};

/**
 * Compact pill that reflects a sender's converted policy. Rendered wherever the
 * sender identity appears (reader header, sender card) so the badge stays
 * consistent across surfaces once a conversion completes.
 */
export function SenderBadge({
  policy,
  className,
}: {
  policy: SenderPolicy | undefined;
  className?: string;
}) {
  if (!policy) return null;
  const option = getSenderPolicyOption(policy);
  const Icon = option.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        toneClasses[policy],
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {option.badge}
    </span>
  );
}
