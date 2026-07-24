import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportSourcePicker } from "./ImportSourcePicker";
import { IdentityReviewTable } from "./IdentityReviewTable";
import { BulkWriteProgressPanel } from "./BulkWriteProgressPanel";
import { parseImportCsv, deduplicateRows } from "./csvParser";
import { matchAllIdentities, type ContactRef } from "./identityMatcher";
import {
  buildWriteJobs,
  createProgress,
  runAllBatches,
  pauseWrite,
  resumeWrite,
  createMemoryPolicyApi,
  type PolicyApi,
} from "./bulkPolicyWriter";
import { saveSession, defaultRetentionForSource, cleanExpiredSessions } from "./dataRetention";
import type {
  BulkWriteProgress,
  DataRetentionPolicy,
  ImportedContactRow,
  ImportSource,
  MigrationStep,
} from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  onComplete: (result: { rows: ImportedContactRow[]; writes: number }) => void;
  /** Stellar address of the current user (mailbox owner). */
  owner: string;
  /** Known contacts from the user's address book for identity matching. */
  knownContacts?: ContactRef[];
  /** Optional policy API override — defaults to memory API for demo. */
  policyApi?: PolicyApi;
};

const STEP_LABELS: Record<MigrationStep, string> = {
  source: "Choose source",
  parse: "Import contacts",
  "identity-review": "Review identity matches",
  trust: "Set trust defaults",
  migrate: "Migrating",
  done: "Complete",
};

const VISIBLE_STEPS: MigrationStep[] = ["source", "identity-review", "migrate", "done"];

const variants = {
  enter: (d: number) => ({ x: d * 28, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.2, ease: "easeOut" as const } },
  exit: (d: number) => ({
    x: d * -28,
    opacity: 0,
    transition: { duration: 0.16, ease: "easeIn" as const },
  }),
};

export function ContactMigrationDialog({
  open,
  onClose,
  onComplete,
  owner,
  knownContacts = [],
  policyApi: externalApi,
}: Props) {
  const [step, setStep] = useState<MigrationStep>("source");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [rows, setRows] = useState<ImportedContactRow[]>([]);
  const [bulkProgress, setBulkProgress] = useState<BulkWriteProgress | null>(null);
  const [fallbackTrust, setFallbackTrust] = useState<"allow" | "block" | "default">("default");
  const [retention, setRetention] = useState<DataRetentionPolicy>("session");
  const [source, setSource] = useState<ImportSource>("csv");
  const apiRef = useRef<PolicyApi>(externalApi ?? createMemoryPolicyApi());
  const runningRef = useRef(false);

  // Clean expired sessions on mount
  useEffect(() => {
    if (open) cleanExpiredSessions();
  }, [open]);

  function goTo(next: MigrationStep) {
    const curr = VISIBLE_STEPS.indexOf(step);
    const nxt = VISIBLE_STEPS.indexOf(next);
    setDirection(nxt > curr ? 1 : -1);
    setStep(next);
  }

  function handleSourceSelect(src: ImportSource, rawCsv?: string) {
    setSource(src);

    let parsed: ImportedContactRow[];

    if (src === "csv" && rawCsv) {
      parsed = parseImportCsv(rawCsv, src);
    } else if (src === "manual") {
      parsed = [
        {
          id: `manual-${Date.now()}`,
          name: "",
          address: "",
          source: src,
          trust: "default",
          match: null,
          error: "Address is required.",
        },
      ];
    } else {
      parsed = [];
    }

    // Deduplicate first, then match (avoids matching duplicates)
    const deduplicated = deduplicateRows(parsed);
    const matched = matchAllIdentities(deduplicated, knownContacts);
    setRows(matched);
    setRetention(defaultRetentionForSource(src));
    goTo("identity-review");
  }

  async function handleStartMigration() {
    const validRows = rows.filter((r) => !r.error);
    if (validRows.length === 0) return;

    const jobs = buildWriteJobs(validRows, owner, fallbackTrust);
    if (jobs.length === 0) {
      // nothing to write — skip straight to done
      onComplete({ rows: validRows, writes: 0 });
      onClose();
      return;
    }

    const progress = createProgress(jobs);
    setBulkProgress(progress);
    goTo("migrate");

    runningRef.current = true;
    const final = await runAllBatches(progress, apiRef.current, owner, (p) => {
      setBulkProgress({ ...p });
    });
    runningRef.current = false;
    setBulkProgress(final);

    // Record session
    saveSession({
      id: crypto.randomUUID?.() ?? `import-${Date.now()}`,
      source,
      createdAt: new Date().toISOString(),
      rawDataRetention: retention,
      contactCount: validRows.length,
      assignedCount: final.succeeded,
      policyWrites: final.succeeded,
      bulkWrite: final,
    });

    if (final.status === "completed") {
      goTo("done");
    }
  }

  function handlePause() {
    if (!bulkProgress) return;
    setBulkProgress(pauseWrite(bulkProgress));
  }

  async function handleResume() {
    if (!bulkProgress) return;
    const resumed = resumeWrite(bulkProgress);
    setBulkProgress(resumed);

    runningRef.current = true;
    const final = await runAllBatches(resumed, apiRef.current, owner, (p) => {
      setBulkProgress({ ...p });
    });
    runningRef.current = false;
    setBulkProgress(final);

    if (final.status === "completed") {
      goTo("done");
    }
  }

  function handleCancel() {
    runningRef.current = false;
    onClose();
  }

  function handleFinish() {
    if (bulkProgress) {
      onComplete({ rows: rows.filter((r) => !r.error), writes: bulkProgress.succeeded });
    }
    setStep("source");
    setRows([]);
    setBulkProgress(null);
    onClose();
  }

  const stepIndex = VISIBLE_STEPS.indexOf(step);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="migration-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            key="migration-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-strong fixed left-1/2 top-1/2 z-50 w-[min(580px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl"
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Contact migration</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* step label */}
            <div className="px-5 pt-3 pb-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Step {stepIndex + 1} of {VISIBLE_STEPS.length}
                </span>
                <span className="text-[11px] text-white/30">·</span>
                <span className="text-[11px] text-foreground/80">{STEP_LABELS[step]}</span>
              </div>

              {/* progress bar */}
              <div className="mt-2 flex gap-1">
                {VISIBLE_STEPS.map((_, i) => (
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
            </div>

            {/* content */}
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
                  {step === "source" && <ImportSourcePicker onSelectSource={handleSourceSelect} />}

                  {step === "identity-review" && (
                    <div className="space-y-4">
                      <IdentityReviewTable rows={rows} onChange={setRows} />

                      {/* retention notice */}
                      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="text-[11px] text-muted-foreground">
                          Imported data retention:{" "}
                          <select
                            value={retention}
                            onChange={(e) => setRetention(e.target.value as DataRetentionPolicy)}
                            className="bg-transparent border-b border-white/10 text-foreground outline-none"
                          >
                            <option value="session">Session only</option>
                            <option value="1h">1 hour</option>
                            <option value="24h">24 hours</option>
                            <option value="7d">7 days</option>
                            <option value="never">Never delete</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => goTo("source")}
                          className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => {
                            const defaultCount = rows.filter(
                              (r) => !r.error && r.trust === "default",
                            ).length;
                            if (defaultCount > 0) {
                              setStep("trust");
                              setDirection(1);
                            } else {
                              handleStartMigration();
                            }
                          }}
                          disabled={rows.filter((r) => !r.error).length === 0}
                          className={cn(
                            "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                            rows.filter((r) => !r.error).length > 0
                              ? "bg-foreground text-background hover:opacity-90"
                              : "cursor-not-allowed bg-white/10 text-muted-foreground",
                          )}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}

                  {step === "trust" && (
                    <TrustDefaultsStep
                      defaultCount={rows.filter((r) => !r.error && r.trust === "default").length}
                      fallbackTrust={fallbackTrust}
                      onChange={setFallbackTrust}
                      onBack={() => goTo("identity-review")}
                      onContinue={handleStartMigration}
                    />
                  )}

                  {step === "migrate" && bulkProgress && (
                    <BulkWriteProgressPanel
                      progress={bulkProgress}
                      onPause={handlePause}
                      onResume={handleResume}
                      onCancel={handleCancel}
                    />
                  )}

                  {step === "done" && (
                    <MigrationDoneStep
                      succeeded={bulkProgress?.succeeded ?? 0}
                      total={rows.filter((r) => !r.error).length}
                      retention={retention}
                      onFinish={handleFinish}
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

function TrustDefaultsStep({
  defaultCount,
  fallbackTrust,
  onChange,
  onBack,
  onContinue,
}: {
  defaultCount: number;
  fallbackTrust: "allow" | "block" | "default";
  onChange: (v: "allow" | "block" | "default") => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const options: { value: "allow" | "block" | "default"; label: string; desc: string }[] = [
    {
      value: "default",
      label: "Skip (leave as unset)",
      desc: "No policy written. Mailbox policy applies to these senders.",
    },
    {
      value: "allow",
      label: "Trust them all",
      desc: "Messages delivered immediately. Can undo per-contact in settings.",
    },
    {
      value: "block",
      label: "Block them all",
      desc: "Messages quarantined to Spam. Can undo per-contact in settings.",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Set trust defaults</h2>
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground">{defaultCount}</span> contact
          {defaultCount !== 1 ? "s" : ""} still on "Default". Choose what to apply. Per-contact
          overrides are preserved.
        </p>
      </div>

      <div className="grid gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-xl border p-4 text-left transition",
              fallbackTrust === opt.value
                ? "border-white/20 bg-white/[0.08]"
                : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
            )}
          >
            <span className="block text-sm font-medium text-foreground">{opt.label}</span>
            <span className="block text-xs text-muted-foreground">{opt.desc}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
        >
          Start migration
        </button>
      </div>
    </div>
  );
}

function MigrationDoneStep({
  succeeded,
  total,
  retention,
  onFinish,
}: {
  succeeded: number;
  total: number;
  retention: DataRetentionPolicy;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Migration complete</h2>
        <p className="text-sm text-muted-foreground">
          {succeeded} of {total} sender rule{succeeded !== 1 ? "s" : ""} written successfully.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Sender rules written</span>
          <span className="text-foreground font-medium">{succeeded}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Contacts imported</span>
          <span className="text-foreground font-medium">{total}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Raw data retention</span>
          <span className="text-foreground font-medium">
            {retention === "session"
              ? "Session only"
              : retention === "1h"
                ? "1 hour"
                : retention === "24h"
                  ? "24 hours"
                  : retention === "7d"
                    ? "7 days"
                    : "Never"}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        You can review and undo individual assignments from the contacts panel at any time.
      </p>

      <button
        onClick={onFinish}
        className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
      >
        Done
      </button>
    </div>
  );
}
