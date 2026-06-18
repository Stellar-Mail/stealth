import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "solid" | "subtle" | "ghost";

const variantClasses: Record<Variant, string> = {
  solid: "bg-foreground text-background hover:opacity-90",
  subtle: "border border-white/12 bg-white/[0.05] text-foreground/90 hover:bg-white/[0.09]",
  ghost: "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
};

/**
 * Shared entry point into the sender-conversion flow. Used from the request
 * card, the sender (contact) card, and the reader header so every CTA opens the
 * exact same guided dialog with consistent affordance and label.
 */
export function ConvertSenderButton({
  onClick,
  label = "Convert to contact",
  variant = "subtle",
  className,
}: {
  onClick: () => void;
  label?: string;
  variant?: Variant;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
        variantClasses[variant],
        className,
      )}
    >
      <UserPlus className="h-3.5 w-3.5" aria-hidden />
      <span>{label}</span>
    </button>
  );
}
