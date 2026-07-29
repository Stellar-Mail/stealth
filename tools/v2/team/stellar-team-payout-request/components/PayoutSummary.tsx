export interface PayoutSummaryProps {
  recipient: string;
  amount: string;
  memo: string;
  status: "Draft" | "Ready";
}

export function PayoutSummary({ recipient, amount, memo, status }: PayoutSummaryProps) {
  return (
    <section aria-labelledby="summary-heading" className="rounded-xl border p-6">
      <h2 id="summary-heading" className="text-lg font-semibold">
        Request Summary
      </h2>

      <dl className="mt-4 space-y-3">
        <div>
          <dt className="font-medium">Recipient</dt>
          <dd>{recipient}</dd>
        </div>

        <div>
          <dt className="font-medium">Amount</dt>
          <dd>{amount}</dd>
        </div>

        <div>
          <dt className="font-medium">Memo</dt>
          <dd>{memo}</dd>
        </div>

        <div>
          <dt className="font-medium">Status</dt>
          <dd>
            <span className="rounded-full border px-2 py-1 text-xs">{status}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
