export interface CustomerSupportMacroEmptyStateProps {
  onCreateMacro?: () => void;
}

export function CustomerSupportMacroEmptyState({
  onCreateMacro,
}: CustomerSupportMacroEmptyStateProps) {
  return (
    <section aria-labelledby="customer-support-empty-heading">
      <h2 id="customer-support-empty-heading">No macros available</h2>

      <p>Create your first customer support macro to get started.</p>

      {onCreateMacro ? (
        <button type="button" onClick={onCreateMacro}>
          Create macro
        </button>
      ) : null}
    </section>
  );
}
