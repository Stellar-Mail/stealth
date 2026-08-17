import { cn } from "@/lib/utils";
import { SkeletonAvatar, SkeletonBlock, SkeletonButton, SkeletonText } from "./skeleton";

/**
 * Skeleton screens for each major app panel.
 *
 * Each skeleton mirrors the real panel's layout dimensions so there is no
 * jump when live content loads. No fake personal data is exposed — every
 * placeholder has aria-hidden="true" and role="presentation".
 */

/* ── shared helpers ─────────────────────────────────────────────────── */

function Row({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2.5", className)} {...props} />;
}

/* ── MailListSkeleton ───────────────────────────────────────────────── */

function MailListItem() {
  return (
    <li className="flex items-start gap-2 px-2.5 py-2">
      {/* checkbox stand-in */}
      <SkeletonBlock className="mt-2 size-4 rounded-[4px] shrink-0" />
      {/* card */}
      <div className="flex min-w-0 flex-1 items-start gap-3 rounded-[14px] px-3 py-2.5">
        <SkeletonAvatar sizeClass="h-7 w-7" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Row className="justify-between">
            <SkeletonBlock className="h-3.5 w-28 rounded-sm" />
            <SkeletonBlock className="h-3 w-10 rounded-sm" />
          </Row>
          <SkeletonBlock className="h-3 w-40 rounded-sm" />
          <SkeletonBlock className="h-3 w-32 rounded-sm opacity-60" />
        </div>
      </div>
    </li>
  );
}

export function MailListSkeleton({ className }: { className?: string }) {
  return (
    <section
      aria-label="Loading mail list"
      aria-busy="true"
      className={cn(
        "relative m-3 flex h-[calc(100vh-3.5rem-1.5rem)] w-full flex-col overflow-hidden rounded-[8px] md:w-[328px] md:shrink-0 lg:w-[336px]",
        className,
      )}
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-3.5 py-3">
        <div className="space-y-1">
          <SkeletonBlock className="h-3.5 w-20 rounded-sm" />
          <SkeletonBlock className="h-3 w-28 rounded-sm opacity-60" />
        </div>
        <SkeletonBlock className="h-7 w-40 rounded-[6px]" />
      </div>
      {/* list */}
      <ul className="flex-1 space-y-2 overflow-hidden p-2.5" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <MailListItem key={i} />
        ))}
      </ul>
    </section>
  );
}

/* ── MailReaderSkeleton ─────────────────────────────────────────────── */

export function MailReaderSkeleton({ className }: { className?: string }) {
  return (
    <section
      aria-label="Loading mail reader"
      aria-busy="true"
      className={cn(
        "mail-reader-atmosphere relative flex flex-1 flex-col overflow-hidden rounded-[8px]",
        className,
      )}
    >
      {/* toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-4 py-2.5">
        <Row>
          <SkeletonButton widthClass="w-8" />
          <SkeletonButton widthClass="w-8" />
          <SkeletonButton widthClass="w-8" />
        </Row>
        <Row>
          <SkeletonButton widthClass="w-16" />
          <SkeletonButton widthClass="w-16" />
        </Row>
      </div>

      {/* content */}
      <div className="flex-1 overflow-hidden px-6 py-5 space-y-5">
        {/* sender block */}
        <Row className="gap-3">
          <SkeletonAvatar sizeClass="size-9" />
          <div className="space-y-1.5 min-w-0 flex-1">
            <Row className="justify-between">
              <SkeletonBlock className="h-4 w-36 rounded-sm" />
              <SkeletonBlock className="h-3 w-20 rounded-sm opacity-60" />
            </Row>
            <SkeletonBlock className="h-3 w-48 rounded-sm opacity-70" />
          </div>
        </Row>

        {/* subject */}
        <SkeletonBlock className="h-6 w-3/4 rounded-sm" />

        {/* body */}
        <div className="space-y-3 pt-1">
          <SkeletonText lines={3} />
          <SkeletonText lines={4} lastLineWidthClass="w-1/2" />
          <SkeletonText lines={2} lastLineWidthClass="w-2/3" />
        </div>

        {/* attachment pills */}
        <Row className="pt-2">
          <SkeletonBlock className="h-8 w-28 rounded-[6px]" />
          <SkeletonBlock className="h-8 w-24 rounded-[6px]" />
        </Row>
      </div>
    </section>
  );
}

/* ── CalendarSkeleton ───────────────────────────────────────────────── */

function CalendarDayCell({ hasEvent }: { hasEvent?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg p-1.5">
      <SkeletonBlock className="h-5 w-5 rounded-full mx-auto" />
      {hasEvent && <SkeletonBlock className="h-1.5 w-4/5 mx-auto rounded-full opacity-50" />}
    </div>
  );
}

export function CalendarSkeleton({ className }: { className?: string }) {
  const days = [false, true, false, false, true, false, true, false, false, false, true, false, false, false, true, true, false, false, false, true, false, false, false, false, false, false, false, false, false, false, true, false, false, false, false]; // prettier-ignore
  return (
    <section
      aria-label="Loading calendar"
      aria-busy="true"
      className={cn("flex flex-col gap-4 p-4", className)}
    >
      {/* month nav */}
      <Row className="justify-between px-1">
        <SkeletonButton widthClass="w-8" />
        <SkeletonBlock className="h-5 w-28 rounded-sm" />
        <SkeletonButton widthClass="w-8" />
      </Row>

      {/* day-of-week header */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBlock key={i} className="mx-auto h-3.5 w-6 rounded-sm opacity-50" />
        ))}
      </div>

      {/* calendar grid (5 weeks) */}
      <div className="grid grid-cols-7 gap-1">
        {days.slice(0, 35).map((hasEvent, i) => (
          <CalendarDayCell key={i} hasEvent={hasEvent} />
        ))}
      </div>

      {/* upcoming events */}
      <div className="mt-2 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Row key={i} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <SkeletonBlock className="h-8 w-1 rounded-full shrink-0" />
            <div className="space-y-1 min-w-0 flex-1">
              <SkeletonBlock className="h-3.5 w-32 rounded-sm" />
              <SkeletonBlock className="h-3 w-20 rounded-sm opacity-60" />
            </div>
          </Row>
        ))}
      </div>
    </section>
  );
}

/* ── SettingsSkeleton ───────────────────────────────────────────────── */

function SettingsRow() {
  return (
    <Row className="justify-between py-3 border-b border-white/[0.06] last:border-0">
      <div className="space-y-1">
        <SkeletonBlock className="h-3.5 w-32 rounded-sm" />
        <SkeletonBlock className="h-3 w-52 rounded-sm opacity-60" />
      </div>
      <SkeletonBlock className="h-6 w-10 rounded-full shrink-0" />
    </Row>
  );
}

export function SettingsSkeleton({ className }: { className?: string }) {
  return (
    <section
      aria-label="Loading settings"
      aria-busy="true"
      className={cn("flex flex-col gap-6 p-5", className)}
    >
      {/* identity card */}
      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4 space-y-3">
        <Row className="gap-3">
          <SkeletonAvatar sizeClass="size-10" shape="square" />
          <div className="space-y-1.5 flex-1">
            <SkeletonBlock className="h-4 w-36 rounded-sm" />
            <SkeletonBlock className="h-3 w-44 rounded-sm opacity-60" />
          </div>
        </Row>
      </div>

      {/* section groups */}
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g}>
          <SkeletonBlock className="mb-2 h-3 w-20 rounded-sm opacity-50" />
          <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4">
            {Array.from({ length: 3 }).map((_, r) => (
              <SettingsRow key={r} />
            ))}
          </div>
        </div>
      ))}

      {/* save button */}
      <div className="flex justify-end">
        <SkeletonButton widthClass="w-24" />
      </div>
    </section>
  );
}

/* ── RightPanelSkeleton ─────────────────────────────────────────────── */

export function RightPanelSkeleton({ className }: { className?: string }) {
  return (
    <aside
      aria-label="Loading context panel"
      aria-busy="true"
      className={cn("flex h-full flex-col gap-4 overflow-hidden p-4", className)}
    >
      {/* action buttons row */}
      <Row className="flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonButton key={i} widthClass="w-20" />
        ))}
      </Row>

      {/* sender card */}
      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 space-y-2">
        <Row className="gap-3">
          <SkeletonAvatar sizeClass="size-8" />
          <div className="space-y-1 flex-1">
            <SkeletonBlock className="h-3.5 w-28 rounded-sm" />
            <SkeletonBlock className="h-3 w-36 rounded-sm opacity-60" />
          </div>
        </Row>
        <SkeletonBlock className="h-6 w-24 rounded-full" />
      </div>

      {/* related events */}
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-20 rounded-sm opacity-50" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Row key={i} className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5">
            <SkeletonBlock className="h-7 w-1 rounded-full shrink-0" />
            <div className="space-y-1 flex-1">
              <SkeletonBlock className="h-3.5 w-28 rounded-sm" />
              <SkeletonBlock className="h-3 w-16 rounded-sm opacity-60" />
            </div>
          </Row>
        ))}
      </div>

      {/* provenance block */}
      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 space-y-2.5">
        <SkeletonBlock className="h-3 w-24 rounded-sm opacity-50" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Row key={i} className="justify-between">
            <SkeletonBlock className="h-3 w-20 rounded-sm opacity-60" />
            <SkeletonBlock className="h-3 w-12 rounded-sm" />
          </Row>
        ))}
      </div>
    </aside>
  );
}
