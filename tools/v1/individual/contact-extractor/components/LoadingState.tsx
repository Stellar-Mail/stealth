export interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Extracting contacts..." }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Extracting contacts from email"
      className="flex flex-col items-center justify-center min-h-64 bg-muted/30 rounded-lg border border-border p-8"
    >
      <div className="sr-only">{message}</div>
      <div
        className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
        aria-hidden="true"
      />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
