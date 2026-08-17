import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SharedDraftErrorStateProps {
  error: string;
  onRetry: () => void;
}

/**
 * SharedDraftErrorState
 * Accessible error state with recovery option
 *
 * Accessibility considerations:
 * - Alert role for error announcement
 * - Descriptive error message
 * - Clear retry action with proper button labeling
 * - Icon has aria-hidden since label is text
 */
export const SharedDraftErrorState: React.FC<SharedDraftErrorStateProps> = ({ error, onRetry }) => {
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Failed to load shared drafts</AlertTitle>
      <AlertDescription className="mt-4 space-y-3">
        <p className="text-sm">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          aria-label="Retry loading shared drafts"
        >
          Try Again
        </Button>
      </AlertDescription>
    </Alert>
  );
};
