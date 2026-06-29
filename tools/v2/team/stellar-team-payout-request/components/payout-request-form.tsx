import { useState, useId } from "react";
import type {
  PayoutFormValues,
  PayoutPriority,
  StellarNetwork,
  PayoutValidationError,
} from "../types";

interface PayoutRequestFormProps {
  onSubmit: (values: PayoutFormValues) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const PRIORITY_OPTIONS: { value: PayoutPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function validate(values: PayoutFormValues): PayoutValidationError[] {
  const errors: PayoutValidationError[] = [];
  if (!values.recipientName.trim()) {
    errors.push({ field: "recipientName", message: "Recipient name is required." });
  }
  if (!STELLAR_ADDRESS_RE.test(values.recipientStellarAddress.trim())) {
    errors.push({
      field: "recipientStellarAddress",
      message: "Enter a valid Stellar account ID (starts with G, 56 characters).",
    });
  }
  const amount = parseFloat(values.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push({ field: "amount", message: "Amount must be a positive number." });
  }
  if (!values.description.trim()) {
    errors.push({ field: "description", message: "Description is required." });
  }
  if (values.memo && new TextEncoder().encode(values.memo).length > 28) {
    errors.push({ field: "memo", message: "Memo must be 28 bytes or fewer." });
  }
  return errors;
}

/**
 * PayoutRequestForm
 *
 * Accessible form for submitting a team payout request.
 *
 * Accessibility features:
 * - All inputs have associated <label> via htmlFor / id
 * - Validation errors linked via aria-describedby
 * - Required fields marked with aria-required
 * - Error summary announced via role="alert"
 * - Submit disabled during loading
 */
export function PayoutRequestForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: PayoutRequestFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [values, setValues] = useState<PayoutFormValues>({
    recipientName: "",
    recipientStellarAddress: "",
    recipientEmail: "",
    amount: "",
    description: "",
    memo: "",
    priority: "normal",
    network: "testnet",
  });
  const [errors, setErrors] = useState<PayoutValidationError[]>([]);
  const [touched, setTouched] = useState<Set<keyof PayoutFormValues>>(new Set());

  const fieldError = (field: keyof PayoutFormValues) =>
    errors.find((e) => e.field === field)?.message;

  const set =
    (field: keyof PayoutFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
      setTouched((t) => new Set(t).add(field));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    if (errs.length === 0) {
      onSubmit(values);
    }
  };

  const inputClass = (field: keyof PayoutFormValues) =>
    `w-full rounded-lg border px-3 py-2 text-sm bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      touched.has(field) && fieldError(field) ? "border-destructive" : "border-input"
    }`;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="New payout request"
      className="space-y-5 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-xl font-semibold text-foreground">New Payout Request</h2>

      {/* Error summary */}
      {errors.length > 0 && (
        <div
          role="alert"
          aria-label="Form errors"
          className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p className="font-medium mb-1">Please fix the following:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {errors.map((e) => (
              <li key={e.field}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recipient Name */}
      <div className="space-y-1">
        <label htmlFor={id("recipientName")} className="text-sm font-medium text-foreground">
          Recipient Name{" "}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <input
          id={id("recipientName")}
          type="text"
          autoComplete="name"
          aria-required="true"
          aria-describedby={fieldError("recipientName") ? id("recipientName-err") : undefined}
          value={values.recipientName}
          onChange={set("recipientName")}
          className={inputClass("recipientName")}
          disabled={isLoading}
        />
        {touched.has("recipientName") && fieldError("recipientName") && (
          <p id={id("recipientName-err")} role="alert" className="text-xs text-destructive">
            {fieldError("recipientName")}
          </p>
        )}
      </div>

      {/* Stellar Address */}
      <div className="space-y-1">
        <label htmlFor={id("stellarAddress")} className="text-sm font-medium text-foreground">
          Stellar Account ID{" "}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <input
          id={id("stellarAddress")}
          type="text"
          autoComplete="off"
          aria-required="true"
          placeholder="G…"
          aria-describedby={`${id("stellarAddress-hint")}${fieldError("recipientStellarAddress") ? ` ${id("stellarAddress-err")}` : ""}`}
          value={values.recipientStellarAddress}
          onChange={set("recipientStellarAddress")}
          className={inputClass("recipientStellarAddress")}
          disabled={isLoading}
        />
        <p id={id("stellarAddress-hint")} className="text-xs text-muted-foreground">
          56-character Stellar public key starting with G
        </p>
        {touched.has("recipientStellarAddress") && fieldError("recipientStellarAddress") && (
          <p id={id("stellarAddress-err")} role="alert" className="text-xs text-destructive">
            {fieldError("recipientStellarAddress")}
          </p>
        )}
      </div>

      {/* Email (optional) */}
      <div className="space-y-1">
        <label htmlFor={id("email")} className="text-sm font-medium text-foreground">
          Recipient Email <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id={id("email")}
          type="email"
          autoComplete="email"
          value={values.recipientEmail ?? ""}
          onChange={set("recipientEmail")}
          className={inputClass("recipientEmail")}
          disabled={isLoading}
        />
      </div>

      {/* Amount */}
      <div className="space-y-1">
        <label htmlFor={id("amount")} className="text-sm font-medium text-foreground">
          Amount (XLM){" "}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <input
          id={id("amount")}
          type="number"
          min="0.0000001"
          step="any"
          aria-required="true"
          aria-describedby={fieldError("amount") ? id("amount-err") : undefined}
          value={values.amount}
          onChange={set("amount")}
          className={inputClass("amount")}
          disabled={isLoading}
        />
        {touched.has("amount") && fieldError("amount") && (
          <p id={id("amount-err")} role="alert" className="text-xs text-destructive">
            {fieldError("amount")}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label htmlFor={id("description")} className="text-sm font-medium text-foreground">
          Description{" "}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <textarea
          id={id("description")}
          rows={3}
          aria-required="true"
          aria-describedby={fieldError("description") ? id("description-err") : undefined}
          value={values.description}
          onChange={set("description")}
          className={`${inputClass("description")} resize-none`}
          disabled={isLoading}
        />
        {touched.has("description") && fieldError("description") && (
          <p id={id("description-err")} role="alert" className="text-xs text-destructive">
            {fieldError("description")}
          </p>
        )}
      </div>

      {/* Memo */}
      <div className="space-y-1">
        <label htmlFor={id("memo")} className="text-sm font-medium text-foreground">
          Memo <span className="text-muted-foreground font-normal">(optional, max 28 bytes)</span>
        </label>
        <input
          id={id("memo")}
          type="text"
          maxLength={28}
          aria-describedby={`${id("memo-hint")}${fieldError("memo") ? ` ${id("memo-err")}` : ""}`}
          value={values.memo ?? ""}
          onChange={set("memo")}
          className={inputClass("memo")}
          disabled={isLoading}
        />
        <p id={id("memo-hint")} className="text-xs text-muted-foreground">
          Appears on the Stellar transaction
        </p>
        {touched.has("memo") && fieldError("memo") && (
          <p id={id("memo-err")} role="alert" className="text-xs text-destructive">
            {fieldError("memo")}
          </p>
        )}
      </div>

      {/* Priority */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Priority</legend>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Payout priority">
          {PRIORITY_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring ${
                values.priority === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name={id("priority")}
                value={value}
                checked={values.priority === value}
                onChange={() => setValues((v) => ({ ...v, priority: value }))}
                className="sr-only"
                disabled={isLoading}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Network */}
      <div className="space-y-1">
        <label htmlFor={id("network")} className="text-sm font-medium text-foreground">
          Network
        </label>
        <select
          id={id("network")}
          value={values.network}
          onChange={set("network")}
          className={inputClass("network")}
          disabled={isLoading}
        >
          <option value="testnet">Testnet</option>
          <option value="mainnet">Mainnet</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          aria-busy={isLoading}
        >
          {isLoading ? "Submitting…" : "Submit Request"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export type { PayoutRequestFormProps };
