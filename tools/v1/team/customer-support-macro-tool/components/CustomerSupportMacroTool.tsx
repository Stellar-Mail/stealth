import type { Macro } from "../types";
import { CustomerSupportMacroCard } from "./CustomerSupportMacroCard";
import { CustomerSupportMacroEmptyState } from "./CustomerSupportMacroEmptyState";
import { CustomerSupportMacroErrorState } from "./CustomerSupportMacroErrorState";
import { CustomerSupportMacroLoadingState } from "./CustomerSupportMacroLoadingState";
import { CustomerSupportMacroSummary } from "./CustomerSupportMacroSummary";

export interface CustomerSupportMacroToolProps {
  macros: Macro[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onCreateMacro?: () => void;
  onSelectMacro?: (macro: Macro) => void;
}

export function CustomerSupportMacroTool({
  macros,
  loading = false,
  error,
  onRetry,
  onCreateMacro,
  onSelectMacro,
}: CustomerSupportMacroToolProps) {
  if (loading) {
    return <CustomerSupportMacroLoadingState />;
  }

  if (error) {
    return <CustomerSupportMacroErrorState message={error} onRetry={onRetry} />;
  }

  if (macros.length === 0) {
    return <CustomerSupportMacroEmptyState onCreateMacro={onCreateMacro} />;
  }

  return (
    <section aria-labelledby="customer-support-macro-tool-heading">
      <h1 id="customer-support-macro-tool-heading">Customer Support Macros</h1>

      <CustomerSupportMacroSummary macros={macros} />

      <div>
        {macros.map((macro) => (
          <CustomerSupportMacroCard key={macro.id} macro={macro} onSelect={onSelectMacro} />
        ))}
      </div>
    </section>
  );
}
