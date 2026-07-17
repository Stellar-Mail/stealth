import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  onReset?: () => void;
}

export function EmptyState({ onReset }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-64 bg-muted/30 rounded-lg border border-border p-8"
      role="status"
      aria-live="polite"
      aria-label="No contacts found"
    >
      <Users className="w-12 h-12 text-muted-foreground mb-4" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-foreground mb-2">No contacts found</h2>
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        The email text you provided doesn't contain any extractable contact information. Try pasting
        a different message.
      </p>
      {onReset && (
        <Button
          variant="outline"
          onClick={onReset}
          aria-label="Try extracting contacts from a different email"
        >
          Try Another Email
        </Button>
      )}
    </div>
  );
}
