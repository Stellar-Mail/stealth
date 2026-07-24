interface PayoutFormProps {
  onSubmit: () => void;
}

export function PayoutForm({ onSubmit }: PayoutFormProps) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <label htmlFor="recipient">Recipient</label>

        <input id="recipient" type="email" className="mt-1 w-full rounded-md border p-2" />
      </div>

      <div>
        <label htmlFor="amount">Amount (XLM)</label>

        <input id="amount" type="number" className="mt-1 w-full rounded-md border p-2" />
      </div>

      <div>
        <label htmlFor="memo">Memo</label>

        <input id="memo" className="mt-1 w-full rounded-md border p-2" />
      </div>

      <button type="submit" className="rounded-md border px-4 py-2">
        Submit request
      </button>
    </form>
  );
}
