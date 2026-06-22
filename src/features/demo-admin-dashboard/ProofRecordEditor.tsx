/**
 * ProofRecordEditor — admin form for editing a demo ProofRecord.
 *
 * All data is fake, deterministic, and safe for public repository review.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProofPostageStatus, ProofRecord, ProofRecordDraft } from "./types/proofRecord";
import { formatPostageStatus, validateProofRecord } from "./proofFormatting";

export type ProofRecordEditorProps = {
  /** The proof record to edit. */
  record: ProofRecord;
  /** Called with the full updated record when the form is saved. */
  onSave: (updated: ProofRecord) => void;
  /** Optional cancel handler. */
  onCancel?: () => void;
  /** Optional className override for the root element. */
  className?: string;
};

const POSTAGE_STATUSES: ProofPostageStatus[] = ["pending", "settled", "refunded"];

/** Controlled text input row used within the editor. */
function FieldRow({
  label,
  id,
  value,
  onChange,
  error,
  mono,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cn(
          "rounded-md border bg-white/[0.03] px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition focus:ring-1",
          mono && "font-mono",
          error
            ? "border-rose-500/50 focus:ring-rose-500/40"
            : "border-white/[0.08] focus:ring-white/20",
        )}
      />
      {error && (
        <p id={`${id}-err`} role="alert" className="text-[11px] text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function ProofRecordEditor({ record, onSave, onCancel, className }: ProofRecordEditorProps) {
  const [draft, setDraft] = useState<ProofRecordDraft>({
    messageHash: record.messageHash,
    paymentHash: record.paymentHash,
    contractAddress: record.contractAddress,
    diagnosticId: record.diagnosticId,
    latency: record.latency,
    signature: record.signature,
    postageStatus: record.postageStatus,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function setField<K extends keyof ProofRecordDraft>(key: K, value: ProofRecordDraft[K]) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    // Clear the error for the changed field immediately so the UI stays responsive.
    if (submitted) {
      const fieldErrors = validateProofRecord(next);
      const map: Record<string, string> = {};
      for (const e of fieldErrors) map[e.field] = e.message;
      setErrors(map);
    }
  }

  function handleSave() {
    setSubmitted(true);
    const fieldErrors = validateProofRecord(draft);
    if (fieldErrors.length > 0) {
      const map: Record<string, string> = {};
      for (const e of fieldErrors) map[e.field] = e.message;
      setErrors(map);
      return;
    }
    setErrors({});
    onSave({ ...record, ...draft });
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5",
        className,
      )}
      aria-label="Edit proof record"
    >
      <header className="border-b border-white/[0.06] pb-3">
        <h3 className="text-sm font-semibold text-foreground">Edit Proof Record</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          ID: <span className="font-mono">{record.id}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldRow
          label="Message Hash"
          id="messageHash"
          value={draft.messageHash}
          onChange={(v) => setField("messageHash", v)}
          error={errors["messageHash"]}
          mono
        />
        <FieldRow
          label="Payment Hash"
          id="paymentHash"
          value={draft.paymentHash}
          onChange={(v) => setField("paymentHash", v)}
          error={errors["paymentHash"]}
          mono
        />
        <FieldRow
          label="Contract Address"
          id="contractAddress"
          value={draft.contractAddress}
          onChange={(v) => setField("contractAddress", v)}
          error={errors["contractAddress"]}
          mono
        />
        <FieldRow
          label="Diagnostic ID"
          id="diagnosticId"
          value={draft.diagnosticId}
          onChange={(v) => setField("diagnosticId", v)}
          error={errors["diagnosticId"]}
          mono
        />
        <FieldRow
          label="Latency"
          id="latency"
          value={draft.latency}
          onChange={(v) => setField("latency", v)}
          error={errors["latency"]}
        />
        <FieldRow
          label="Signature"
          id="signature"
          value={draft.signature}
          onChange={(v) => setField("signature", v)}
          error={errors["signature"]}
          mono
        />

        {/* Postage status selector */}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Postage Status
          </span>
          <div role="group" aria-label="Postage status" className="flex gap-2">
            {POSTAGE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setField("postageStatus", status)}
                aria-pressed={draft.postageStatus === status}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-medium transition",
                  draft.postageStatus === status
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                    : "border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:text-foreground",
                )}
              >
                {formatPostageStatus(status)}
              </button>
            ))}
          </div>
          {errors["postageStatus"] && (
            <p role="alert" className="text-[11px] text-rose-400">
              {errors["postageStatus"]}
            </p>
          )}
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t border-white/[0.06] pt-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-white/20 hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20"
        >
          Save
        </button>
      </footer>
    </section>
  );
}
