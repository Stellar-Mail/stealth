/**
 * Team Security Flagging Tool - Filters Component
 *
 * Filter controls for security flags
 */

import { useState, useId } from "react";
import { Filter, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { FlagFilters, FlagSeverity, FlagStatus, FlagCategory } from "../types";
import { SEVERITY_META, STATUS_META, CATEGORY_META, ARIA_LABELS } from "../constants";
import { announce } from "../utils/accessibility";

interface FlagFiltersProps {
  filters: FlagFilters;
  onFiltersChange: (filters: FlagFilters) => void;
  resultCount?: number;
  isOpen?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function FlagFilters({
  filters,
  onFiltersChange,
  resultCount,
  isOpen = true,
  onToggle,
  className,
}: FlagFiltersProps) {
  const searchId = useId();
  const hasActiveFilters =
    (filters.severity && filters.severity.length > 0) ||
    (filters.status && filters.status.length > 0) ||
    (filters.category && filters.category.length > 0) ||
    !!filters.searchQuery;

  const clearFilters = () => {
    onFiltersChange({});
    announce("All filters cleared");
  };

  const updateSearch = (query: string) => {
    onFiltersChange({ ...filters, searchQuery: query });
    if (query) {
      announce(`Searching for: ${query}`);
    }
  };

  const toggleSeverity = (severity: FlagSeverity) => {
    const current = filters.severity || [];
    const updated = current.includes(severity)
      ? current.filter((s) => s !== severity)
      : [...current, severity];

    onFiltersChange({ ...filters, severity: updated });
    announce(
      current.includes(severity)
        ? `${SEVERITY_META[severity].label} severity filter removed`
        : `${SEVERITY_META[severity].label} severity filter added`,
    );
  };

  const toggleStatus = (status: FlagStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];

    onFiltersChange({ ...filters, status: updated });
    announce(
      current.includes(status)
        ? `${STATUS_META[status].label} status filter removed`
        : `${STATUS_META[status].label} status filter added`,
    );
  };

  const toggleCategory = (category: FlagCategory) => {
    const current = filters.category || [];
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];

    onFiltersChange({ ...filters, category: updated });
    announce(
      current.includes(category)
        ? `${CATEGORY_META[category].label} category filter removed`
        : `${CATEGORY_META[category].label} category filter added`,
    );
  };

  return (
    <div className={cn("space-y-4", className)} role="search" aria-label={ARIA_LABELS.filters}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Filters</h2>
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
              {[
                filters.severity?.length || 0,
                filters.status?.length || 0,
                filters.category?.length || 0,
                filters.searchQuery ? 1 : 0,
              ].reduce((sum, count) => sum + count, 0)}
            </span>
          )}
        </div>

        {onToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            aria-label={isOpen ? "Collapse filters" : "Expand filters"}
            aria-expanded={isOpen}
          >
            {isOpen ? "Collapse" : "Expand"}
          </Button>
        )}
      </div>

      {isOpen && (
        <>
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor={searchId} className="sr-only">
              {ARIA_LABELS.searchInput}
            </Label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id={searchId}
                type="search"
                placeholder="Search flags..."
                value={filters.searchQuery || ""}
                onChange={(e) => updateSearch(e.target.value)}
                className="pl-9"
                aria-label={ARIA_LABELS.searchInput}
              />
            </div>
          </div>

          <Separator />

          {/* Severity filter */}
          <FilterSection
            title="Severity"
            items={Object.entries(SEVERITY_META)}
            selectedItems={filters.severity || []}
            onToggle={toggleSeverity}
            renderLabel={(meta) => meta.label}
          />

          <Separator />

          {/* Status filter */}
          <FilterSection
            title="Status"
            items={Object.entries(STATUS_META)}
            selectedItems={filters.status || []}
            onToggle={toggleStatus}
            renderLabel={(meta) => meta.label}
          />

          <Separator />

          {/* Category filter */}
          <FilterSection
            title="Category"
            items={Object.entries(CATEGORY_META)}
            selectedItems={filters.category || []}
            onToggle={toggleCategory}
            renderLabel={(meta) => meta.label}
          />

          {/* Clear filters */}
          {hasActiveFilters && (
            <>
              <Separator />
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="w-full"
                aria-label="Clear all filters"
              >
                <X className="size-4 mr-2" aria-hidden="true" />
                Clear All Filters
              </Button>
            </>
          )}

          {/* Result count */}
          {resultCount !== undefined && (
            <div
              className="text-xs text-muted-foreground text-center"
              role="status"
              aria-live="polite"
            >
              {resultCount} flag{resultCount !== 1 ? "s" : ""} found
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Filter section component
 */
interface FilterSectionProps<T> {
  title: string;
  items: [string, T][];
  selectedItems: string[];
  onToggle: (key: string) => void;
  renderLabel: (meta: T) => string;
}

function FilterSection<T>({
  title,
  items,
  selectedItems,
  onToggle,
  renderLabel,
}: FilterSectionProps<T>) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">{title}</legend>
      <div className="space-y-2">
        {items.map(([key, meta]) => {
          const id = `filter-${title.toLowerCase()}-${key}`;
          const isChecked = selectedItems.includes(key);

          return (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={isChecked}
                onCheckedChange={() => onToggle(key)}
                aria-label={`Filter by ${renderLabel(meta)}`}
              />
              <Label
                htmlFor={id}
                className="text-sm text-muted-foreground cursor-pointer hover:text-foreground"
              >
                {renderLabel(meta)}
              </Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Compact filter badge component
 */
export function FilterBadge({
  label,
  onRemove,
  className,
}: {
  label: string;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-primary/10 text-primary border border-primary/20",
        className,
      )}
    >
      {label}
      <button
        onClick={onRemove}
        className="hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-label={`Remove ${label} filter`}
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  );
}
