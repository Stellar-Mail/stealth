import { cn } from "@/lib/utils";
import {
  MailListSkeleton,
  MailReaderSkeleton,
  RightPanelSkeleton,
  SkeletonBlock,
} from "@/features/design-system";

/**
 * Layout-stable placeholder shown while preference state is restored.
 *
 * Mirrors the three-pane mail shell so there is no visual jump when the
 * stored sidebar, list, and reader widths replace the skeleton. All
 * placeholders are decorative and hidden from assistive technology.
 */
export function PreferencesSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-label="Loading preferences"
      aria-busy="true"
      className={cn("flex h-screen w-full overflow-hidden bg-background", className)}
    >
      {/* Sidebar placeholder */}
      <aside className="hidden h-full w-16 shrink-0 flex-col items-center gap-4 border-r border-white/10 p-3 md:flex">
        <SkeletonBlock className="h-8 w-8 rounded-lg" />
        <div className="mt-4 w-full space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="mx-auto h-8 w-8 rounded-lg" />
          ))}
        </div>
      </aside>

      {/* Main area placeholder */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar placeholder */}
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <SkeletonBlock className="h-8 w-40 rounded-md" />
          <SkeletonBlock className="h-8 w-8 rounded-md" />
        </div>

        {/* Three-pane content */}
        <div className="flex min-h-0 flex-1">
          <MailListSkeleton className="m-0 h-full w-full rounded-none border-0 md:w-1/3" />
          <MailReaderSkeleton className="hidden h-full w-1/3 rounded-none border-0 md:flex" />
          <RightPanelSkeleton className="hidden h-full w-1/3 lg:flex" />
        </div>
      </div>
    </div>
  );
}
