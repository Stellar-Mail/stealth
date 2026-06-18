import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChangelog } from "./useChangelog";

const CATEGORY_LABELS: Record<string, string> = {
  ui: "UI",
  api: "API",
  protocol: "Protocol",
  security: "Security",
};

const CATEGORY_COLORS: Record<string, string> = {
  ui: "bg-sky-400/15 text-sky-300",
  api: "bg-violet-400/15 text-violet-300",
  protocol: "bg-amber-400/15 text-amber-300",
  security: "bg-rose-400/15 text-rose-300",
};

export function ChangelogPanel() {
  const { entries, markAllSeen, isEntryUnread } = useChangelog();

  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

  const grouped = entries.reduce<Record<string, typeof entries>>((acc, entry) => {
    const key = `${entry.version}|${entry.date}`;
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Release notes</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          UI, API, protocol, and security changes — in plain language.
        </p>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([key, groupEntries]) => {
          const [version, date] = key.split("|");
          const hasUnreadInGroup = groupEntries.some((e) => isEntryUnread(e.version));

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">v{version}</span>
                  {hasUnreadInGroup && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>

              <div className="space-y-2 pl-0.5">
                {groupEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "rounded-xl border p-3 transition",
                      isEntryUnread(entry.version)
                        ? "border-white/10 bg-white/[0.04]"
                        : "border-white/5 bg-white/[0.015]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              CATEGORY_COLORS[entry.category] ??
                                "bg-white/10 text-muted-foreground",
                            )}
                          >
                            {CATEGORY_LABELS[entry.category] ?? entry.category}
                          </span>
                          <span className="text-xs font-medium text-foreground">{entry.title}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {entry.description}
                        </p>
                      </div>
                    </div>
                    {entry.link && (
                      <a
                        href={entry.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-1 text-[11px] text-sky-400 transition hover:text-sky-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {entry.link.label}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
