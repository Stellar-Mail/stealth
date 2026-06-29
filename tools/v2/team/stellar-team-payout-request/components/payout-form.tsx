/**
 * PayoutForm
 *
 * Form for creating a new Stellar payout request.
 * Validates inputs inline. Does not call Horizon or sign transactions —
 * that is the responsibility of the caller via onSubmit.
 */
import { useState, type FormEvent } from "react";
import type { PayoutFormData } from "../types";
import { validatePayoutRequest } from "../services";

interface PayoutFormProps {
  onSubmit: (data: PayoutFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function PayoutForm({ onSubmit, onCancel, isLoading = false }: PayoutFormProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PayoutFormData, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const data: PayoutFormData = { recipientEmail, amount, memo: memo || undefined };
    const result = validatePayoutRequest(data);

    if (!result.valid) {
      setFieldErrors(result.errors);
      return;
    }

    setFieldErrors({});

    try {
      await onSubmit(data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    }
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Payout request form">
      <fieldset disabled={isLoading} className="space-y-5">
        <legend className="sr-only">Payout request details</legend>

        {/* Recipient Email */}
        <div>
          <label htmlFor="payout-email" className="block text-sm font-medium text-foreground">
            Recipient email{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <input
            id="payout-email"
            type="email"
            autoComplete="email"
            required
            aria-required="true"
            aria-describedby={fieldErrors.recipientEmail ? "payout-email-error" : undefined}
            aria-invalid={!!fieldErrors.recipientEmail}
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="team@example.com"
            className={inputClass}
          />
          {fieldErrors.recipientEmail ? (
            <p id="payout-email-error" role="alert" className="mt-1 text-xs text-destructive">
              {fieldErrors.recipientEmail}
            </p>
          ) : null}
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="payout-amount" className="block text-sm font-medium text-foreground">
            Amount (XLM){" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <input
            id="payout-amount"
            type="text"
            inputMode="decimal"
            required
            aria-required="true"
            aria-describedby={fieldErrors.amount ? "payout-amount-error" : "payout-amount-hint"}
            aria-invalid={!!fieldErrors.amount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10.0000000"
            className={inputClass}
          />
          <p id="payout-amount-hint" className="mt-1 text-xs text-muted-foreground">
            Enter the XLM amount (up to 7 decimal places).
          </p>
          {fieldErrors.amount ? (
            <p id="payout-amount-error" role="alert" className="mt-1 text-xs text-destructive">
              {fieldErrors.amount}
            </p>
          ) : null}
        </div>

        {/* Memo (optional) */}
        <div>
          <label htmlFor="payout-memo" className="block text-sm font-medium text-foreground">
            Memo <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="payout-memo"
            type="text"
            maxLength={28}
            aria-describedby={fieldErrors.memo ? "payout-memo-error" : "payout-memo-hint"}
            aria-invalid={!!fieldErrors.memo}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Team payout Q2"
            className={inputClass}
          />
          <p id="payout-memo-hint" className="mt-1 text-xs text-muted-foreground">
            Max 28 bytes. Visible on the Stellar ledger.
          </p>
          {fieldErrors.memo ? (
            <p id="payout-memo-error" role="alert" className="mt-1 text-xs text-destructive">
              {fieldErrors.memo}
            </p>
          ) : null}
        </div>

        {/* Submit error */}
        {submitError ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            aria-busy={isLoading}
          >
            {isLoading ? "Submitting…" : "Submit payout request"}
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}

export type { PayoutFormProps };
