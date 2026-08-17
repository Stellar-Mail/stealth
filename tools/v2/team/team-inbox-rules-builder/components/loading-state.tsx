interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading rules..." }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 p-8"
    >
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
