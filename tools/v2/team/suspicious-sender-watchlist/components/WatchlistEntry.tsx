import React from "react";
import { Shield, Trash2 } from "lucide-react";
import { Button } from "../../../src/components/ui/button";
import { Badge } from "../../../src/components/ui/badge";

interface WatchlistEntryProps {
  id: string;
  senderEmail: string;
  senderName: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  dateAdded: string;
  onRemove: (id: string) => void;
}

const riskColors = {
  low: "bg-yellow-100 text-yellow-800",
  medium: "bg-orange-100 text-orange-800",
  high: "bg-red-100 text-red-800",
};

/**
 * WatchlistEntry
 * Individual watchlist entry with keyboard/focus support
 *
 * Accessibility considerations:
 * - Semantic HTML with proper heading hierarchy
 * - Keyboard accessible delete button
 * - Focus indicator on interactive elements
 * - aria-label for icon-only buttons
 * - Logical tab order
 */
export const WatchlistEntry: React.FC<WatchlistEntryProps> = ({
  id,
  senderEmail,
  senderName,
  reason,
  riskLevel,
  dateAdded,
  onRemove,
}) => {
  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors focus-within:ring-2 focus-within:ring-blue-500">
      <Shield className="h-5 w-5 text-slate-400 mt-1 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-slate-900 break-words">{senderName || senderEmail}</h3>
        <p className="text-sm text-slate-500 break-words">{senderEmail}</p>
        <p className="text-sm text-slate-600 mt-2">{reason}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge className={riskColors[riskLevel]} variant="secondary">
            {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
          </Badge>
          <span className="text-xs text-slate-500">
            Added {new Date(dateAdded).toLocaleDateString()}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(id)}
        className="text-slate-400 hover:text-red-600 flex-shrink-0"
        aria-label={`Remove ${senderEmail || senderName} from watchlist`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
