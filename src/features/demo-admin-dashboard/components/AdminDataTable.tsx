import React, { useState, useMemo } from "react";
import { ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | boolean;
  render?: (row: T) => React.ReactNode;
}

interface AdminDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  selectedRowKey?: (row: T) => boolean;
  defaultSortKey?: string;
  defaultSortDirection?: "asc" | "desc";
  emptyMessage?: string;
  className?: string;
}

/**
 * Pure helper function to sort data based on a key and direction.
 */

export function sortData<T>(
  data: T[],
  sortKey: string | null,
  sortDirection: "asc" | "desc",
  column?: Column<T>,
): T[] {
  if (!sortKey) return data;

  return [...data].sort((a, b) => {
    let valA: any = column?.sortValue ? column.sortValue(a) : (a as any)[sortKey];

    let valB: any = column?.sortValue ? column.sortValue(b) : (b as any)[sortKey];

    if (valA === undefined || valA === null) valA = "";
    if (valB === undefined || valB === null) valB = "";

    if (typeof valA === "string" && typeof valB === "string") {
      return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
}

/**
 * Reusable, sortable table component for the Demo Admin Dashboard.
 * Confined to displaying messages, senders, attachments, events, and audit entries.
 */
export function AdminDataTable<T>({
  data,
  columns,
  onRowClick,
  selectedRowKey,
  defaultSortKey,
  defaultSortDirection = "asc",
  emptyMessage = "No records found.",
  className,
}: AdminDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultSortDirection);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedData = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return sortData(data, sortKey, sortDirection, col);
  }, [data, sortKey, sortDirection, columns]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.01]",
        className,
      )}
    >
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={cn(
                    "px-4 py-3 font-medium text-muted-foreground select-none",
                    col.sortable ? "cursor-pointer hover:text-foreground transition-colors" : "",
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="inline-flex text-muted-foreground/60">
                        {!isSorted ? (
                          <ArrowUpDown className="h-3 w-3" />
                        ) : sortDirection === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-amber-400" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, i) => {
              const isSelected = selectedRowKey ? selectedRowKey(row) : false;
              const isClickable = !!onRowClick;
              return (
                <tr
                  key={i}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={cn(
                    "border-b border-white/[0.04] last:border-0 transition-colors",
                    isClickable ? "cursor-pointer hover:bg-white/[0.02]" : "",
                    isSelected ? "bg-white/[0.04]" : "",
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-foreground align-middle">
                      {}
                      {col.render ? col.render(row) : String((row as any)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
