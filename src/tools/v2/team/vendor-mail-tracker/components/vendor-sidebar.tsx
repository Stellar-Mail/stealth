/**
 * VendorSidebar — left panel listing all vendors with thread counts.
 *
 * Each vendor is a button with aria-label summarizing key info.
 * The "All vendors" entry is a virtual item at the top.
 */

import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonBlock } from "@/features/design-system";
import type { Vendor, VendorThread } from "../types";
import { VendorStatusBadge } from "./status-badge";

function formatSpend(cents: number): string {
  if (cents === 0) return "—";
  const dollars = cents / 100;
  return dollars >= 1000
    ? `$${(dollars / 1000).toFixed(1)}k/mo`
    : `$${dollars.toFixed(0)}/mo`;
}

interface VendorItemProps {
  vendor: Vendor;
  unreadCount: number;
  isSelected: boolean;
  onSelect: () => void;
}

function VendorItem({ vendor, unreadCount, isSelected, onSelect }: VendorItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${vendor.name}, ${vendor.category}, ${vendor.status}${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      className={cn(
        "glow-ring group w-full rounded-xl border px-3 py-2.5 text-left transition",
        isSelected
          ? "border-white/20 bg-white/[0.08]"
          : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.04]",
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-1.5">
        <span
          className={cn(
            "truncate text-xs font-medium leading-snug",
            isSelected ? "text-foreground" : "text-foreground/80",
          )}
        >
          {vendor.name}
        </span>
        {unreadCount > 0 && (
          <span
            className="shrink-0 rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-bold text-black"
            aria-label={`${unreadCount} unread`}
          >
            {unreadCount}
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground capitalize">{vendor.category}</span>
        <span className="text-[10px] text-muted-foreground" aria-hidden>
          ·
        </span>
        <span className="text-[10px] text-muted-foreground">{formatSpend(vendor.monthlySpendCents)}</span>
      </div>

      {/* Status */}
      <div className="mt-1.5">
        <VendorStatusBadge status={vendor.status} />
      </div>
    </button>
  );
}

interface VendorSidebarProps {
  vendors: Vendor[];
  threads: VendorThread[];
  selectedVendorId: string | null;
  onSelectVendor: (id: string | null) => void;
  isLoading?: boolean;
}

export function VendorSidebar({
  vendors,
  threads,
  selectedVendorId,
  onSelectVendor,
  isLoading,
}: VendorSidebarProps) {
  const totalUnread = threads.filter((t) => t.unread).length;

  if (isLoading) {
    return (
      <aside
        aria-label="Vendors list — loading"
        aria-busy="true"
        className="space-y-1 py-2"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-transparent px-3 py-2.5 space-y-1.5"
            aria-hidden="true"
          >
            <SkeletonBlock className="h-3.5 w-28 rounded-sm" />
            <SkeletonBlock className="h-3 w-20 rounded-sm opacity-60" />
            <SkeletonBlock className="h-4 w-12 rounded-full opacity-50" />
          </div>
        ))}
      </aside>
    );
  }

  return (
    <aside aria-label="Vendors list" className="space-y-1">
      {/* Section heading */}
      <p
        className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        id="vendor-list-heading"
      >
        Vendors
      </p>

      {/* All vendors row */}
      <button
        type="button"
        onClick={() => onSelectVendor(null)}
        aria-pressed={selectedVendorId === null}
        aria-label={`All vendors${totalUnread > 0 ? `, ${totalUnread} unread` : ""}`}
        className={cn(
          "glow-ring flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
          selectedVendorId === null
            ? "border-white/20 bg-white/[0.08]"
            : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.04]",
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-xs font-medium text-foreground/80">All vendors</span>
        {totalUnread > 0 && (
          <span className="rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-bold text-black">
            {totalUnread}
          </span>
        )}
      </button>

      {/* Individual vendors */}
      <ul role="list" aria-labelledby="vendor-list-heading" className="space-y-0.5">
        {vendors.map((vendor) => {
          const unread = threads.filter(
            (t) => t.vendorId === vendor.id && t.unread,
          ).length;
          return (
            <li key={vendor.id}>
              <VendorItem
                vendor={vendor}
                unreadCount={unread}
                isSelected={selectedVendorId === vendor.id}
                onSelect={() => onSelectVendor(vendor.id)}
              />
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
