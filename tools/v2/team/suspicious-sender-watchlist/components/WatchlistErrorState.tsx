import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "../../../src/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../../../src/components/ui/alert";

interface WatchlistErrorStateProps {
  error: string;
  onRetry: () => void;
}

/**
 * WatchlistErrorState
 * Accessible error state with recovery option
 *
 * Accessibility considerations:
 * - Alert role for error announcement
 * - Descriptive error message
 * - Clear retry action with proper button labeling
 * - Icon has aria-hidden since label is text
 */
export const WatchlistErrorState: React.FC<WatchlistErrorStateProps> = ({ error, onRetry }) => {
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Failed to load watchlist</AlertTitle>
      <AlertDescription className="mt-4 space-y-3">
        <p className="text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry} aria-label="Retry loading watchlist">
          Try Again
        </Button>
      </AlertDescription>
    </Alert>
  );
};
