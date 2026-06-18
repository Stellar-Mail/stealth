import React from "react";
import { Button } from "../../../src/components/ui/button";
import { WatchlistEntry } from "./WatchlistEntry";

interface WatchlistEntryData {
  id: string;
  senderEmail: string;
  senderName: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  dateAdded: string;
}

interface WatchlistListProps {
  entries: WatchlistEntryData[];
  onRemove: (id: string) => void;
  onAddNew: () => void;
}

/**
 * WatchlistList
 * Main list component displaying watchlist entries (success state)
 *
 * Accessibility considerations:
 * - Semantic list structure
 * - aria-label for list context
 * - Proper heading hierarchy
 * - Keyboard navigation support through entries
 * - Summary info for screen readers
 */
export const WatchlistList: React.FC<WatchlistListProps> = ({ entries, onRemove, onAddNew }) => {
  const highRiskCount = entries.filter((e) => e.riskLevel === "high").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Watchlist</h2>
          <p className="text-sm text-slate-600 mt-1">
            Monitoring {entries.length} sender{entries.length !== 1 ? "s" : ""}
            {highRiskCount > 0 && ` • ${highRiskCount} high risk`}
          </p>
        </div>
        <Button onClick={onAddNew} aria-label="Add a new sender to watchlist">
          Add Sender
        </Button>
      </div>

      <ul className="space-y-3" role="list" aria-label="Suspicious senders watchlist">
        {entries.map((entry) => (
          <li key={entry.id} role="listitem">
            <WatchlistEntry {...entry} onRemove={onRemove} />
          </li>
        ))}
      </ul>
    </div>
  );
};
