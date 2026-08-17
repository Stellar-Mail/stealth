import { ArrowDownUp, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import {
  buildCampaignListRows,
  clearCampaignSelection,
  defaultCampaignListSort,
  nextCampaignListSort,
  selectAllCampaigns,
  summarizeCampaignSelection,
  toggleCampaignSelection,
  type CampaignListSort,
  type CampaignListSortKey,
} from "../campaignListTable";

export interface CampaignListTableProps {
  campaigns: CampaignSnapshot[];
  selectedIds?: string[];
  sort?: CampaignListSort;
  onSelectionChange?: (selectedIds: string[]) => void;
  onSortChange?: (sort: CampaignListSort) => void;
  className?: string;
}

const sortableColumns: Array<{ key: CampaignListSortKey; label: string }> = [
  { key: "name", label: "Campaign" },
  { key: "targetAudience", label: "Audience" },
  { key: "status", label: "Status" },
  { key: "drafts", label: "Drafts" },
  { key: "updated", label: "Updated" },
];

export function CampaignListTable({
  campaigns,
  selectedIds = [],
  sort = defaultCampaignListSort,
  onSelectionChange,
  onSortChange,
  className,
}: CampaignListTableProps) {
  const rows = buildCampaignListRows(campaigns, selectedIds, sort);
  const selection = summarizeCampaignSelection(campaigns, selectedIds);
  const allSelected = campaigns.length > 0 && selection.selectedCount === campaigns.length;

  const updateSelection = (nextSelectedIds: string[]) => {
    onSelectionChange?.(nextSelectedIds);
  };

  const updateSort = (key: CampaignListSortKey) => {
    onSortChange?.(nextCampaignListSort(sort, key));
  };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div>
          <h3 className="text-sm font-medium">Campaign list</h3>
          <p className="text-xs text-muted-foreground">
            {selection.selectedCount} of {selection.totalCount} selected
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            updateSelection(allSelected ? clearCampaignSelection() : selectAllCampaigns(campaigns))
          }
          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-foreground hover:bg-white/[0.04]"
        >
          {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/[0.06] text-xs text-muted-foreground">
            <tr>
              <th className="w-12 px-4 py-3">Select</th>
              {sortableColumns.map((column) => (
                <th key={column.key} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => updateSort(column.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {column.label}
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    {sort.key === column.key ? (
                      <span className="text-[10px] uppercase">{sort.direction}</span>
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-white/[0.04] last:border-0">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    aria-label={`Toggle ${row.name}`}
                    onClick={() => updateSelection(toggleCampaignSelection(selectedIds, row.id))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {row.selected ? (
                      <CheckSquare className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.tags.join(", ") || "untagged"}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.targetAudience}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-xs text-muted-foreground">
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.draftCount}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(row.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No campaign records yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
