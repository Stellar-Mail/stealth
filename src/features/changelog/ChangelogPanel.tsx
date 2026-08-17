import { useEffect, useMemo, memo } from "react";
import { ExternalLink, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChangelog } from "./useChangelog";
import { CATEGORY_CONFIG, groupEntriesByRelease } from "./helpers";

// `Intl`-backed date formatting is one of the more expensive calls a
// component can make on every render; entries are a small, static set of
// (version, date) pairs, so a plain module-level cache avoids reformatting
// the same date over and over across re-renders and across mounts within
// the same session.
const dateFormatCache = new Map<string, string>();
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
function formatReleaseDate(date: string): string {
  let formatted = dateFormatCache.get(date);
  if (formatted === undefined) {
    formatted = dateFormatter.format(new Date(date));
    dateFormatCache.set(date, formatted);
  }
  return formatted;
}

const CategoryBadge = memo(function CategoryBadge({ category }: { category: string }) {
  const config = CATEGORY_CONFIG[category];
  if (!config) {
    return (
      <Badge variant="outline" className="text-xs font-medium">
        {category}
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors duration-200 motion-reduce:transition-none",
        config.styles,
      )}
    >
      {config.label}
    </span>
  );
});

const ReleaseHeader = memo(function ReleaseHeader({
  version,
  date,
  hasUnread,
}: {
  version: string;
  date: string;
  hasUnread: boolean;
}) {
  const formattedDate = formatReleaseDate(date);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h4 className="text-xs font-semibold text-foreground">
          <span aria-hidden="true">v{version}</span>
          <span className="sr-only">Version {version}</span>
        </h4>
        {hasUnread && (
          <div role="status" aria-label="New changes available" className="flex items-center">
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              title="New changes in this release"
              aria-hidden="true"
            />
          </div>
        )}
      </div>
      <time dateTime={date} className="text-[11px] text-muted-foreground">
        <span className="sr-only">Published on </span>
        {formattedDate}
      </time>
    </div>
  );
});

const ChangelogEntry = memo(function ChangelogEntry({
  entry,
  isUnread,
}: {
  entry: any;
  isUnread: boolean;
}) {
  return (
    <article
      className={cn(
        "group rounded-lg border transition-all duration-200 motion-reduce:transition-none",
        "hover:shadow-sm hover:border-white/15",
        "focus-within:ring-1 focus-within:ring-ring",
        isUnread
          ? "border-white/15 bg-white/[0.06]"
          : "border-white/5 bg-white/[0.015] hover:bg-white/[0.04]",
      )}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryBadge category={entry.category} />
              <h5 className="text-xs font-medium text-foreground leading-tight">
                {entry.title}
                {isUnread && <span className="sr-only"> (Unread)</span>}
              </h5>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{entry.description}</p>
          </div>
        </div>

        {entry.link && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              "mt-2 h-auto p-0 text-[11px] text-sky-400 transition-colors duration-200 motion-reduce:transition-none",
              "hover:text-sky-300 focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            <a
              href={entry.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              {entry.link.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Button>
        )}
      </div>
    </article>
  );
});

export function ChangelogPanel() {
  const { entries, markAllSeen, isEntryUnread, hasUnread } = useChangelog();

  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

  const grouped = useMemo(() => groupEntriesByRelease(entries), [entries]);

  // isEntryUnread only depends on the (stable, mount-time) initial seen
  // version, so each entry's unread state is computed once here instead of
  // being recomputed by calling the helper again for every entry on every
  // render (previously called both per-group, via `.some`, and per-entry
  // inside the render loop below).
  const unreadByVersion = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const entry of entries) {
      if (!map.has(entry.version)) {
        map.set(entry.version, isEntryUnread(entry.version));
      }
    }
    return map;
  }, [entries, isEntryUnread]);

  const isEmpty = entries.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Release notes</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              UI, API, protocol, and security changes — in plain language.
            </p>
          </div>
          {!isEmpty && !hasUnread && (
            <div
              className="flex items-center gap-1.5 rounded-md bg-emerald-400/10 px-2.5 py-1.5 border border-emerald-400/20"
              role="status"
              aria-label="All release notes read"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium text-emerald-300">All read</span>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-muted-foreground">No releases yet</p>
            <p className="text-xs text-muted-foreground/75">
              Release notes will appear here when new versions are published.
            </p>
          </div>
        </div>
      )}

      {/* Release Groups */}
      {!isEmpty && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, groupEntries]) => {
            const [version, date] = key.split("|");
            const hasUnreadInGroup = unreadByVersion.get(version) ?? false;

            return (
              <section key={key} className="space-y-3">
                <ReleaseHeader version={version} date={date} hasUnread={hasUnreadInGroup} />
                <div className="space-y-2">
                  {groupEntries.map((entry) => (
                    <ChangelogEntry
                      key={entry.id}
                      entry={entry}
                      isUnread={unreadByVersion.get(entry.version) ?? false}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
