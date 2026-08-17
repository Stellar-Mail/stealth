interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-destructive text-4xl">⚠️</div>
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
