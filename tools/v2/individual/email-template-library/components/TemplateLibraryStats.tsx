import type { TemplateLibraryStats as TemplateLibraryStatsModel } from "../types";

interface TemplateLibraryStatsProps {
  stats: TemplateLibraryStatsModel;
}

const statItems = [
  ["totalTemplates", "Templates"],
  ["categories", "Categories"],
  ["recentlyUpdated", "Updated"],
  ["missingVariableTemplates", "Need values"],
] as const;

export function TemplateLibraryStats({ stats }: TemplateLibraryStatsProps) {
  return (
    <dl
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Email template library summary"
    >
      {statItems.map(([key, label]) => (
        <div key={key} className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-2 text-2xl font-semibold text-slate-950">{stats[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
