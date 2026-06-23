import type { MacroCategory } from "../services/macro.service";

interface MacroSummaryProps {
  favorites: number;
  total: number;
  totalUsage: number;
  visibleCategories: MacroCategory[];
}

export function MacroSummary({
  favorites,
  total,
  totalUsage,
  visibleCategories,
}: MacroSummaryProps) {
  const items = [
    ["Total", total],
    ["Favorites", favorites],
    ["Categories", visibleCategories.length],
    ["Uses", totalUsage],
  ] as const;

  return (
    <dl aria-label="Support macro summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([label, value]) => (
        <div className="rounded-lg border border-slate-200 bg-white p-4" key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type { MacroSummaryProps };
