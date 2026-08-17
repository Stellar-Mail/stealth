import type { Macro } from "../types";

export interface CustomerSupportMacroSummaryProps {
  macros: Macro[];
}

export function CustomerSupportMacroSummary({ macros }: CustomerSupportMacroSummaryProps) {
  const totalMacros = macros.length;
  const favoriteMacros = macros.filter((macro) => macro.isFavorite).length;
  const totalUsage = macros.reduce((total, macro) => total + macro.usageCount, 0);

  return (
    <section aria-labelledby="customer-support-macro-summary-heading">
      <h2 id="customer-support-macro-summary-heading">Macro Summary</h2>

      <dl>
        <dt>Total macros</dt>
        <dd>{totalMacros}</dd>

        <dt>Favorites</dt>
        <dd>{favoriteMacros}</dd>

        <dt>Total usage</dt>
        <dd>{totalUsage}</dd>
      </dl>
    </section>
  );
}
