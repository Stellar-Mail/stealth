export interface CustomerSupportMacroErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function CustomerSupportMacroErrorState({
  message,
  onRetry,
}: CustomerSupportMacroErrorStateProps) {
  return (
    <section role="alert" aria-live="assertive">
      <h2>Unable to load macros</h2>

      <p>{message}</p>

      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </section>
  );
}
