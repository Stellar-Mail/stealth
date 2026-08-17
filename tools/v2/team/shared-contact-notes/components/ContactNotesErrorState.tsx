import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ContactNotesErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ContactNotesErrorState({ message, onRetry }: ContactNotesErrorStateProps) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Failed to load contact notes</AlertTitle>
      <AlertDescription className="mt-4 space-y-3">
        <p className="text-sm">{message}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          aria-label="Retry loading contact notes"
        >
          <RefreshCw className="h-3 w-3 mr-2" aria-hidden="true" />
          Try Again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
