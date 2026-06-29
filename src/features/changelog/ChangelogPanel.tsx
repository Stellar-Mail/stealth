import { useEffect, useMemo } from "react";
import { ExternalLink, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChangelog } from "./useChangelog";

const CATEGORY_CONFIG: Record<string, { label: string; styles: string }> = {
  ui: {
    label: "UI",
    styles: "bg-sky-400/15 text-sky-300 border-sky-400/20 hover:bg-sky-400/20",
  },
  api: {
    label: "API",
    styles: "bg-violet-400/15 text-violet-300 border-violet-400/20 hover:bg-violet-400/20",
  },
  protocol: {
    label: "Protocol",
    styles: "bg-amber-400/15 text-amber-300 border-amber-400/20 hover:bg-amber-400/20",
  },
  security: {
    label: "Security",
    styles: "bg-rose-400/15 text-rose-300 border-rose-400/20 hover:bg-rose-400/20",
  },
};

function CategoryBadge({ category }: { category: string }) {
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
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors duration-200",
        config.styles,
      )}
    >
      {config.label}
    </span>
  );
}

function ReleaseHeader({
  version,
  date,
  hasUnread,
}: {
  version: string;
  date: string;
  hasUnread: boolean;
}) {
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h4 className="text-xs font-semibold text-foreground">v{version}</h4>
        {hasUnread && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            title="New changes in this release"
            aria-label="New changes available"
          />
        )}
      </div>
      <time dateTime={date} className="text-[11px] text-muted-foreground">
        {formattedDate}
      </time>
    </div>
  );
}

function ChangelogEntry({ entry, isUnread }: { entry: any; isUnread: boolean }) {
  return (
    <article
      className={cn(
        "group rounded-lg border transition-all duration-200",
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
              <h5 className="text-xs font-medium text-foreground leading-tight">{entry.title}</h5>
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
              "mt-2 h-auto p-0 text-[11px] text-sky-400 transition-colors duration-200",
              "hover:text-sky-300 focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            <a
              href={entry.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              {entry.link.label}
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

export function ChangelogPanel() {
  const { entries, markAllSeen, isEntryUnread, hasUnread } = useChangelog();

  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

  const grouped = useMemo(
    () =>
      entries.reduce<Record<string, typeof entries>>((acc, entry) => {
        const key = `${entry.version}|${entry.date}`;
        (acc[key] ??= []).push(entry);
        return acc;
      }, {}),
    [entries],
  );

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
          {!isEmpty && hasUnread && (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-400/10 px-2.5 py-1.5 border border-emerald-400/20">
              <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
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
            const hasUnreadInGroup = groupEntries.some((e) => isEntryUnread(e.version));

            return (
              <section key={key} className="space-y-3">
                <ReleaseHeader version={version} date={date} hasUnread={hasUnreadInGroup} />
                <div className="space-y-2">
                  {groupEntries.map((entry) => (
                    <ChangelogEntry
                      key={entry.id}
                      entry={entry}
                      isUnread={isEntryUnread(entry.version)}
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
