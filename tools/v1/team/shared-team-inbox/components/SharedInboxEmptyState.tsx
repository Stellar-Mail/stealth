interface SharedInboxEmptyStateProps {
  activeFilter?: string;
}

export function SharedInboxEmptyState({ activeFilter = "all messages" }: SharedInboxEmptyStateProps) {
  return (
    <section
      aria-labelledby="shared-inbox-empty-title"
      className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"
    >
      <h2 id="shared-inbox-empty-title" className="text-lg font-semibold text-slate-950">
        No shared inbox messages
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        There are no {activeFilter} to triage. New shared inbox mail will appear here.
      </p>
    </section>
  );
}
