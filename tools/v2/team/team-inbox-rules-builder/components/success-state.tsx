interface SuccessStateProps {
  message: string;
  onDismiss?: () => void;
}

export function SuccessState({ message, onDismiss }: SuccessStateProps) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className="flex flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <div className="text-green-500 text-4xl">✓</div>
      <h2 className="text-lg font-semibold">Success</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
