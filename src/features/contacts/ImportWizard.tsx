import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCsv, blankContact, revalidate, findDuplicateAddresses } from "./parseContacts";
import type { ImportedContact } from "./types";

type Step = "input" | "preview" | "trust";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (contacts: ImportedContact[]) => void;
};

// ─── step variants ────────────────────────────────────────────────────────────

const variants = {
  enter: (d: number) => ({ x: d * 28, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.2, ease: "easeOut" as const } },
  exit: (d: number) => ({
    x: d * -28,
    opacity: 0,
    transition: { duration: 0.16, ease: "easeIn" as const },
  }),
};

const STEPS: Step[] = ["input", "preview", "trust"];
const STEP_LABELS: Record<Step, string> = {
  input: "Import contacts",
  preview: "Review & edit",
  trust: "Set trust defaults",
};

// ─── sub-components ───────────────────────────────────────────────────────────

function TrustBadge({
  value,
  onChange,
}: {
  value: ImportedContact["trust"];
  onChange: (v: ImportedContact["trust"]) => void;
}) {
  const options: { value: ImportedContact["trust"]; label: string }[] = [
    { value: "allow", label: "Allow" },
    { value: "default", label: "Default" },
    { value: "block", label: "Block" },
  ];
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ImportedContact["trust"])}
        className={cn(
          "appearance-none rounded-md border px-2 py-0.5 pr-5 text-[11px] font-medium transition",
          value === "allow" && "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300",
          value === "block" && "border-red-400/20 bg-red-400/[0.06] text-red-300",
          value === "default" && "border-white/10 bg-white/[0.04] text-muted-foreground",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 opacity-50" />
    </div>
  );
}

// ─── steps ────────────────────────────────────────────────────────────────────

function InputStep({ onNext }: { onNext: (contacts: ImportedContact[]) => void }) {
  const [csv, setCsv] = useState("");
  const [mode, setMode] = useState<"paste" | "manual">("paste");
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setCsv(e.target?.result as string);
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  function advance() {
    if (mode === "paste") {
      if (!csv.trim()) {
        setParseError("Paste CSV content or upload a file first.");
        return;
      }
      const rows = parseCsv(csv);
      if (rows.length === 0) {
        setParseError("No contacts found. Make sure the CSV has an address column.");
        return;
      }
      setParseError(null);
      onNext(rows);
    } else {
      onNext([blankContact()]);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Import contacts</h2>
        <p className="text-sm text-muted-foreground">
          Upload a CSV or enter contacts manually. No trust is granted automatically.
        </p>
      </div>

      {/* mode tabs */}
      <div className="flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
        {(["paste", "manual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-sm transition",
              mode === m
                ? "bg-white/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "paste" ? "CSV paste / upload" : "Manual entry"}
          </button>
        ))}
      </div>

      {mode === "paste" && (
        <div className="space-y-3">
          {/* drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 transition hover:bg-white/[0.04]"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Drag & drop a <span className="text-foreground">.csv</span> file or click to browse
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {/* paste area */}
          <div className="relative">
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={`name,address\nAlice,alice*example.com\nBob,GABCD…`}
              rows={5}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 outline-none resize-none focus:border-white/20"
            />
            {csv && (
              <button
                onClick={() => setCsv("")}
                className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Columns: <code className="rounded bg-white/[0.06] px-1">name,address</code> or just{" "}
            <code className="rounded bg-white/[0.06] px-1">address</code>
          </p>
        </div>
      )}

      {mode === "manual" && (
        <p className="text-sm text-muted-foreground">
          You'll add and edit contacts one at a time on the next step.
        </p>
      )}

      {parseError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {parseError}
        </div>
      )}

      <button
        onClick={advance}
        className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
      >
        Continue
      </button>
    </div>
  );
}

function PreviewStep({
  contacts,
  onChange,
  onNext,
  onBack,
}: {
  contacts: ImportedContact[];
  onChange: (contacts: ImportedContact[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const duplicates = findDuplicateAddresses(contacts);
  const validCount = contacts.filter((c) => !c.error).length;
  const invalidCount = contacts.filter((c) => c.error).length;
  const dupCount = contacts.filter((c) => duplicates.has(c.address.trim().toLowerCase())).length;

  function updateRow(id: string, patch: Partial<ImportedContact>) {
    onChange(
      contacts.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...patch };
        return "address" in patch ? revalidate(updated) : updated;
      }),
    );
  }

  function removeRow(id: string) {
    onChange(contacts.filter((c) => c.id !== id));
  }

  function addRow() {
    onChange([...contacts, blankContact()]);
  }

  const canAdvance = contacts.length > 0 && validCount > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Review & edit contacts</h2>
        <p className="text-sm text-muted-foreground">
          Fix any errors before continuing. Bad rows can be edited or removed.
        </p>
      </div>

      {/* summary badges */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-muted-foreground">
          {contacts.length} total
        </span>
        {validCount > 0 && (
          <span className="rounded-md border border-emerald-400/20 bg-emerald-400/[0.06] px-2 py-0.5 text-emerald-300">
            {validCount} valid
          </span>
        )}
        {invalidCount > 0 && (
          <span className="rounded-md border border-red-400/20 bg-red-400/[0.06] px-2 py-0.5 text-red-300">
            {invalidCount} error{invalidCount !== 1 ? "s" : ""}
          </span>
        )}
        {dupCount > 0 && (
          <span className="rounded-md border border-amber-400/20 bg-amber-400/[0.06] px-2 py-0.5 text-amber-300">
            {dupCount} duplicate{dupCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* contact rows */}
      <div className="max-h-[272px] overflow-y-auto space-y-2 pr-0.5">
        {contacts.map((c) => {
          const isDup = duplicates.has(c.address.trim().toLowerCase());
          return (
            <div
              key={c.id}
              className={cn(
                "rounded-xl border bg-white/[0.025] p-3 space-y-2",
                c.error ? "border-red-400/20" : isDup ? "border-amber-400/20" : "border-white/10",
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  value={c.name}
                  onChange={(e) => updateRow(c.id, { name: e.target.value })}
                  placeholder="Name (optional)"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20"
                />
                <TrustBadge value={c.trust} onChange={(t) => updateRow(c.id, { trust: t })} />
                <button
                  onClick={() => removeRow(c.id)}
                  aria-label="Remove contact"
                  className="shrink-0 rounded p-1 text-muted-foreground transition hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                value={c.address}
                onChange={(e) => updateRow(c.id, { address: e.target.value })}
                placeholder="alice*stealth.xyz or GABC…"
                className={cn(
                  "w-full rounded-lg border bg-white/[0.04] px-2.5 py-1.5 font-mono text-xs outline-none focus:border-white/20",
                  c.error ? "border-red-400/30 text-red-300" : "border-white/10 text-foreground",
                )}
              />
              {c.error && (
                <p className="flex items-center gap-1 text-[10px] text-red-400">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {c.error}
                </p>
              )}
              {!c.error && isDup && (
                <p className="flex items-center gap-1 text-[10px] text-amber-400">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Duplicate address — only one entry will be saved.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={addRow}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-2 text-xs text-muted-foreground transition hover:border-white/20 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add contact
      </button>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canAdvance}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            canAdvance
              ? "bg-foreground text-background hover:opacity-90"
              : "cursor-not-allowed bg-white/10 text-muted-foreground",
          )}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function TrustStep({
  contacts,
  onBack,
  onSave,
}: {
  contacts: ImportedContact[];
  onBack: () => void;
  onSave: (contacts: ImportedContact[]) => void;
}) {
  const [bulkTrust, setBulkTrust] = useState<ImportedContact["trust"]>("default");
  const [saving, setSaving] = useState(false);

  // Valid contacts only — skip rows with errors
  const valid = contacts.filter((c) => !c.error);
  const defaultCount = valid.filter((c) => c.trust === "default").length;

  const trustOptions: { value: ImportedContact["trust"]; label: string; desc: string }[] = [
    { value: "allow", label: "Allow", desc: "Trusted — messages delivered immediately." },
    { value: "default", label: "Default", desc: "Honour your mailbox policy for unknown senders." },
    { value: "block", label: "Block", desc: "Never deliver messages from these senders." },
  ];

  async function handleSave() {
    setSaving(true);
    // Apply bulk default to any contact still on "default"
    const result = valid.map((c) => (c.trust === "default" ? { ...c, trust: bulkTrust } : c));
    // Deduplicate: last entry wins per address
    const seen = new Map<string, ImportedContact>();
    for (const c of result) seen.set(c.address.trim().toLowerCase(), c);
    await Promise.resolve(); // allow the spinner frame to paint
    onSave([...seen.values()]);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Set trust defaults</h2>
        <p className="text-sm text-muted-foreground">
          Choose what trust level to apply to contacts you left on "Default" (
          <span className="text-foreground">{defaultCount}</span> contact
          {defaultCount !== 1 ? "s" : ""}). Per-contact overrides are preserved.
        </p>
      </div>

      <div className="grid gap-2">
        {trustOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setBulkTrust(opt.value)}
            className={cn(
              "rounded-xl border p-4 text-left transition",
              bulkTrust === opt.value
                ? "border-emerald-400/20 bg-emerald-400/[0.06]"
                : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
            )}
          >
            <span className="block text-sm font-medium text-foreground">{opt.label}</span>
            <span className="block text-xs text-muted-foreground">{opt.desc}</span>
          </button>
        ))}
      </div>

      {/* summary */}
      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground">{valid.length}</span> contact
          {valid.length !== 1 ? "s" : ""} will be saved. No trust is applied silently — your
          explicit decision here is required.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={saving}
          className={cn(
            "flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition",
            saving ? "opacity-40" : "hover:bg-white/[0.04] hover:text-foreground",
          )}
        >
          Back
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            saving
              ? "cursor-not-allowed bg-white/10 text-muted-foreground"
              : "bg-foreground text-background hover:opacity-90",
          )}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </span>
          ) : (
            `Save ${valid.length} contact${valid.length !== 1 ? "s" : ""}`
          )}
        </button>
      </div>
    </div>
  );
}

// ─── wizard shell ─────────────────────────────────────────────────────────────

export function ImportWizard({ open, onClose, onSave }: Props) {
  const [step, setStep] = useState<Step>("input");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [contacts, setContacts] = useState<ImportedContact[]>([]);

  function goTo(next: Step) {
    const curr = STEPS.indexOf(step);
    const nxt = STEPS.indexOf(next);
    setDirection(nxt > curr ? 1 : -1);
    setStep(next);
  }

  function handleInputNext(parsed: ImportedContact[]) {
    setContacts(parsed);
    goTo("preview");
  }

  function handleSave(finalContacts: ImportedContact[]) {
    onSave(finalContacts);
    // reset for next open
    setStep("input");
    setContacts([]);
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="import-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            key="import-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-strong fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl"
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">{STEP_LABELS[step]}</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* progress bar */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-0">
              <div className="flex flex-1 gap-1">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className="h-0.5 flex-1 rounded-full transition-all duration-300"
                    style={{
                      background:
                        i <= stepIndex ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.1)",
                    }}
                  />
                ))}
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {stepIndex + 1} / {STEPS.length}
              </span>
            </div>

            {/* step content */}
            <div className="overflow-hidden px-5 pb-5 pt-4">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {step === "input" && <InputStep onNext={handleInputNext} />}
                  {step === "preview" && (
                    <PreviewStep
                      contacts={contacts}
                      onChange={setContacts}
                      onNext={() => goTo("trust")}
                      onBack={() => goTo("input")}
                    />
                  )}
                  {step === "trust" && (
                    <TrustStep
                      contacts={contacts}
                      onBack={() => goTo("preview")}
                      onSave={handleSave}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
