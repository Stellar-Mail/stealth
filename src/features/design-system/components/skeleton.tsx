import { cn } from "@/lib/utils";

/**
 * Skeleton primitives for layout-stable loading states.
 *
 * Shimmer animation is suppressed when the user prefers reduced motion —
 * the placeholder still renders but becomes a static muted block instead.
 * No component renders placeholder text that could be mistaken for real data.
 */

const base =
  "animate-pulse rounded-md bg-primary/10 motion-reduce:animate-none motion-reduce:bg-muted/40";

export interface SkeletonBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Explicit height via Tailwind class, e.g. "h-4" or "h-[72px]" */
  heightClass?: string;
}

/** Generic rectangular block — use for images, cards, or any freeform shape. */
export function SkeletonBlock({ className, heightClass, ...props }: SkeletonBlockProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(base, heightClass, className)}
      {...props}
    />
  );
}

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of lines to render. */
  lines?: number;
  /** Tailwind width class for the last line (makes it look natural). */
  lastLineWidthClass?: string;
}

/** One or more lines of text-height skeleton rows. */
export function SkeletonText({
  lines = 1,
  lastLineWidthClass = "w-3/4",
  className,
  ...props
}: SkeletonTextProps) {
  return (
    <div role="presentation" aria-hidden="true" className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(base, "h-3.5", i === lines - 1 && lines > 1 && lastLineWidthClass)}
        />
      ))}
    </div>
  );
}

export interface SkeletonAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tailwind size class pair, e.g. "size-8" or "h-7 w-7". Defaults to "size-8". */
  sizeClass?: string;
  /** Use "square" for rounded-lg instead of fully round. */
  shape?: "circle" | "square";
}

/** Circular or square avatar placeholder. */
export function SkeletonAvatar({
  sizeClass = "size-8",
  shape = "circle",
  className,
  ...props
}: SkeletonAvatarProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(
        base,
        sizeClass,
        shape === "circle" ? "rounded-full" : "rounded-lg",
        "shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export interface SkeletonButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tailwind width class, e.g. "w-24". Defaults to "w-20". */
  widthClass?: string;
}

/** Pill-shaped button placeholder. */
export function SkeletonButton({ widthClass = "w-20", className, ...props }: SkeletonButtonProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(base, "h-8 rounded-full", widthClass, className)}
      {...props}
    />
  );
}
