import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SuccessStateProps {
  contactCount: number;
  onReset?: () => void;
}

export function SuccessState({ contactCount, onReset }: SuccessStateProps) {
  return (
    <div
      role="status"
      aria-live="assertive"
      aria-label={`Successfully extracted ${contactCount} contact${contactCount !== 1 ? "s" : ""}`}
      className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800"
    >
      <CheckCircle2
        className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          Extracted {contactCount} contact{contactCount !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Review the details below</p>
      </div>
      {onReset && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          aria-label="Extract contacts from a different email"
          className="shrink-0"
        >
          New Extraction
        </Button>
      )}
    </div>
  );
}
