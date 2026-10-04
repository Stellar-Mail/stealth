import { cva } from "class-variance-authority";

export const actionButtonVariants = cva(
  "glow-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-semibold transition-[background,border-color,color,transform,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      intent: {
        primary:
          "border-primary bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_oklch(1_0_0/0.65)] hover:-translate-y-0.5 hover:bg-primary/90 dark:border-white/80 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100",
        secondary:
          "border-surface-tint/12 bg-surface-tint/[0.07] text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.08)] hover:-translate-y-0.5 hover:border-surface-tint/20 hover:bg-surface-tint/[0.11]",
        ghost:
          "border-transparent text-muted-foreground hover:bg-surface-tint/[0.07] hover:text-foreground",
        danger:
          "border-status-danger/20 bg-status-danger/12 text-status-danger hover:-translate-y-0.5 hover:border-status-danger/30 hover:bg-status-danger/20 dark:border-red-300/20 dark:bg-red-500/12 dark:text-red-100 dark:hover:border-red-300/30 dark:hover:bg-red-500/20",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-[15px]",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      intent: "primary",
      size: "md",
    },
  },
);
