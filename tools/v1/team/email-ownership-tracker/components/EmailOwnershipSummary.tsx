interface EmailOwnershipSummaryProps {
  threadCount: number;
  ownerCount: number;
  handoffCount: number;
  anomalyCount: number;
}

export function EmailOwnershipSummary({
  threadCount,
  ownerCount,
  handoffCount,
  anomalyCount,
}: EmailOwnershipSummaryProps) {
  const items = [
    { label: "Threads", value: threadCount },
    { label: "Owners", value: ownerCount },
    { label: "Handoffs", value: handoffCount },
    { label: "Anomalies", value: anomalyCount },
  ];

  return (
    <section aria-label="Ownership summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-sm font-medium text-slate-500">{item.label}</dt>

          <dd className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</dd>
        </article>
      ))}
    </section>
  );
}

export type { EmailOwnershipSummaryProps };
