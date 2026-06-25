import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
  onReset?: () => void;
}

export function ErrorState({ error, onRetry, onReset }: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-label="Contact extraction error"
      className="flex flex-col items-center justify-center min-h-64 bg-destructive/5 rounded-lg border border-destructive/20 p-8"
    >
      <AlertCircle className="w-12 h-12 text-destructive mb-4" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-destructive mb-2">Extraction failed</h2>
      <p className="text-muted-foreground text-center max-w-sm mb-6">{error}</p>
      <div className="flex gap-3">
        {onRetry && (
          <Button variant="outline" onClick={onRetry} aria-label="Retry contact extraction">
            Try Again
          </Button>
        )}
        {onReset && (
          <Button variant="ghost" onClick={onReset} aria-label="Start over with a new email">
            Start Over
          </Button>
        )}
      </div>
    </div>
  );
}
