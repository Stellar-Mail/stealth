interface EmptyStateProps {
  onNewRule?: () => void;
}

export function EmptyState({ onNewRule }: EmptyStateProps) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-muted-foreground text-4xl">📋</div>
      <h2 className="text-lg font-semibold">No rules defined</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Create your first inbox rule to automatically organize incoming mail.
      </p>
      {onNewRule && (
        <button
          onClick={onNewRule}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          aria-label="Create new rule"
        >
          Create Rule
        </button>
      )}
    </div>
  );
}
