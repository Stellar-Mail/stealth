import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle,
  Copy,
  Database,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Mail,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Email } from "@/components/mail/data";
import { motionPresets } from "@/lib/motion-presets";
import {
  generateMockProofRecords,
  validateProofQuery,
  searchProofRecords,
  type MockProofRecord,
} from "./utils";

interface ProofInspectorModalProps {
  open: boolean;
  onClose: () => void;
  emails: Email[];
  onOpenMessage: (email: Email) => void;
  onShowToast: (message: string, options?: { tone: "success" | "neutral" | "danger" }) => void;
  initialQuery?: string;
}

export function ProofInspectorModal({
  open,
  onClose,
  emails,
  onOpenMessage,
  onShowToast,
  initialQuery = "",
}: ProofInspectorModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [validationMsg, setValidationMsg] = useState<{
    text: string;
    type: "success" | "warning" | "error" | null;
  }>({ text: "", type: null });

  // Reset state when opening/closing
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setHasSearched(!!initialQuery);
      setIsSearching(false);
    } else {
      setQuery("");
      setHasSearched(false);
      setIsSearching(false);
      setValidationMsg({ text: "", type: null });
    }
  }, [open, initialQuery]);

  const proofRecords = useMemo<MockProofRecord[]>(() => {
    return generateMockProofRecords(emails);
  }, [emails]);

  useEffect(() => {
    setValidationMsg(validateProofQuery(query));
  }, [query]);

  const searchResults = useMemo(() => {
    if (!hasSearched) return [];
    return searchProofRecords(proofRecords, query);
  }, [hasSearched, query, proofRecords]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onShowToast(`${label} copied to clipboard`, { tone: "success" });
  };

  const selectedRecord = searchResults[0];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            {...motionPresets.patterns.modal.backdrop}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            {...motionPresets.patterns.modal.content}
            role="dialog"
            aria-modal="true"
            aria-label="Cryptographic proof inspector"
            className="glass-strong fixed left-1/2 top-1/2 z-[101] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-4 bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[oklch(0.85_0.005_270)]" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Stealth Proof Inspector</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Search and audit smart contract ledger proofs and payment preimages.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-white/10"
                aria-label="Close inspector"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-6 py-5 space-y-4">
              {/* Search Bar */}
              <div className="space-y-1.5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!query.trim()) return;
                    setIsSearching(true);
                    setHasSearched(false);
                    setTimeout(() => {
                      setHasSearched(true);
                      setIsSearching(false);
                    }, 400);
                  }}
                  className="relative flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setHasSearched(false);
                        setIsSearching(false);
                      }}
                      placeholder="Enter Message Hash, Payment Preimage, Address, or Sender..."
                      className={cn(
                        "glow-ring h-10 w-full min-w-0 rounded-xl border pl-9 pr-10 text-xs text-foreground bg-black/40",
                        validationMsg.type === "error"
                          ? "border-red-500/40 focus:border-red-500/60"
                          : "border-white/10 focus:border-white/20",
                      )}
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setHasSearched(false);
                          setIsSearching(false);
                        }}
                        className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="h-10 rounded-xl bg-white px-4 text-xs font-bold text-black transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
                  >
                    {isSearching ? "Searching..." : "Inspect"}
                  </button>
                </form>

                {/* Format validation status feedback */}
                {validationMsg.text && (
                  <p
                    className={cn(
                      "text-[10px] font-medium leading-none px-1",
                      validationMsg.type === "success" && "text-emerald-400",
                      validationMsg.type === "warning" && "text-amber-400",
                      validationMsg.type === "error" && "text-red-400",
                    )}
                  >
                    {validationMsg.text}
                  </p>
                )}
              </div>

              {/* Suggestions / Shortcuts when empty */}
              {!hasSearched && !isSearching && (
                <div className="space-y-2.5 pt-2">
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Quick shortcuts (local records)
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {proofRecords.slice(0, 4).map((record) => (
                      <button
                        key={record.emailId}
                        onClick={() => {
                          setQuery(record.messageHash);
                          setIsSearching(true);
                          setHasSearched(false);
                          setTimeout(() => {
                            setHasSearched(true);
                            setIsSearching(false);
                          }, 400);
                        }}
                        className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.01] p-2.5 text-left text-xs transition hover:bg-white/[0.04] hover:border-white/10"
                      >
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground/80 truncate">
                            {record.email.from}
                          </p>
                          <p className="font-mono text-[9px] text-muted-foreground truncate mt-0.5">
                            {record.messageHash.slice(0, 20)}...
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading State */}
              <AnimatePresence mode="wait">
                {isSearching && (
                  <motion.div
                    key="loading-state"
                    {...motionPresets.entrance.fadeIn()}
                    className="space-y-4 pt-2"
                  >
                    <div className="h-16 w-full animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.05]" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="h-[120px] w-full animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.05]" />
                      <div className="h-[120px] w-full animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.05]" />
                      <div className="h-[120px] w-full animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.05]" />
                      <div className="h-[120px] w-full animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.05]" />
                    </div>
                    <div className="h-10 w-full animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.05]" />
                  </motion.div>
                )}

                {/* Search Result display */}
                {hasSearched && !isSearching && (
                  <motion.div key="result-state" {...motionPresets.entrance.fadeIn()}>
                    {searchResults.length === 0 ? (
                      /* MISSING RECORDS / NEXT STEPS GUIDE */
                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.01] p-4 space-y-4">
                        <div className="flex items-start gap-3">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                            <ShieldAlert className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-foreground">
                              Proof Record Not Found
                            </h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              No local cryptographic delivery or payment proofs match your search
                              query.
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-white/5 pt-3.5 space-y-2.5">
                          <h5 className="text-[10px] uppercase tracking-wider text-rose-400/90 font-semibold flex items-center gap-1.5">
                            <Terminal className="h-3 w-3" />
                            Recommended Next Steps
                          </h5>
                          <ul className="space-y-2 text-xs">
                            <li className="flex items-start gap-2">
                              <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                                1.
                              </span>
                              <p className="text-muted-foreground leading-normal">
                                <strong className="text-foreground/90 block">
                                  Verify on Stellar Explorer
                                </strong>
                                Search the transaction hash on{" "}
                                <a
                                  href="https://stellar.expert"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                                >
                                  Stellar.Expert
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>{" "}
                                or the Stellar Laboratory to verify if the payment settled.
                              </p>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                                2.
                              </span>
                              <p className="text-muted-foreground leading-normal">
                                <strong className="text-foreground/90 block">
                                  Check Postage Preimage Settle State
                                </strong>
                                Ensure the recipient's mailbox contract has settled the postage
                                preimage. Unsettled postages automatically return to the sender
                                after 7 days.
                              </p>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                                3.
                              </span>
                              <p className="text-muted-foreground leading-normal">
                                <strong className="text-foreground/90 block">
                                  Inspect Relay Node Diagnostics
                                </strong>
                                Ping the relay server node (`relay-us-east-1.stealth.network`) to
                                check routing logs.
                              </p>
                            </li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      /* RECORD FOUND & DETAILED SECTIONS */
                      <div className="space-y-4">
                        {/* Security Alert: Sensitive payload notice */}
                        <div className="flex items-start gap-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 text-xs text-muted-foreground leading-normal">
                          <Info className="h-3.5 w-3.5 text-[oklch(0.85_0.005_270)] shrink-0 mt-0.5" />
                          <p>
                            <span className="font-semibold text-foreground/80">
                              Diagnostic Mode:
                            </span>{" "}
                            Plaintext payload body and sensitive email attachments are omitted for
                            privacy. Use the "Open Message" button to view and decrypt the message
                            content securely.
                          </p>
                        </div>

                        {/* Header overview */}
                        <div className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/5 p-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Subject (Omitted preview)</span>
                            <span className="font-semibold text-foreground block mt-0.5">
                              {selectedRecord.email.subject.replace(/./g, (c, i) =>
                                i > 4 && i < 20 ? "•" : c,
                              )}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-muted-foreground">Verification State</span>
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold block mt-0.5">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Ledger Verified
                            </span>
                          </div>
                        </div>

                        {/* Structured Details Sections Grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {/* Section 1: Policy Info */}
                          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3 space-y-2">
                            <h5 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-white/5 pb-1">
                              Policy Metadata
                            </h5>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Sender Rule:</span>
                                <span className="font-mono text-foreground capitalize">
                                  {selectedRecord.senderRule}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Cryptographic Contact:
                                </span>
                                <span className="text-foreground font-medium">Yes</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Postage Required:</span>
                                <span className="text-foreground font-medium">Yes</span>
                              </div>
                            </div>
                          </div>

                          {/* Section 2: Postage Info */}
                          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3 space-y-2">
                            <h5 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-white/5 pb-1">
                              Postage details
                            </h5>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Postage Amount:</span>
                                <span className="font-semibold text-foreground">
                                  {Number(selectedRecord.postageAmount) / 10_000_000} XLM
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Postage Status:</span>
                                <span
                                  className={cn(
                                    "font-semibold uppercase text-[9px] px-1 rounded",
                                    selectedRecord.postageStatus === "settled" &&
                                      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                    selectedRecord.postageStatus === "pending" &&
                                      "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                                    selectedRecord.postageStatus === "refunded" &&
                                      "bg-red-500/10 text-red-400 border border-red-500/20",
                                  )}
                                >
                                  {selectedRecord.postageStatus}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Payment Hash:</span>
                                <button
                                  onClick={() =>
                                    copyToClipboard(selectedRecord.paymentHash, "Payment Hash")
                                  }
                                  className="font-mono text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                  {selectedRecord.paymentHash.slice(0, 8)}...
                                  <Copy className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Section 3: Receipt Info */}
                          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3 space-y-2">
                            <h5 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-white/5 pb-1">
                              Receipt details
                            </h5>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Delivered At:</span>
                                <span className="text-foreground">
                                  {selectedRecord.deliveredAt}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Read Receipt:</span>
                                <span className="text-foreground">
                                  {selectedRecord.readAt ?? "Pending read confirmation"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Sender Key:</span>
                                <button
                                  onClick={() =>
                                    copyToClipboard(selectedRecord.email.email, "Sender address")
                                  }
                                  className="font-mono text-[9px] text-foreground/80 hover:underline flex items-center gap-0.5"
                                >
                                  {selectedRecord.email.email.slice(0, 12)}...
                                  <Copy className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Section 4: Relay Metadata */}
                          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3 space-y-2">
                            <h5 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-white/5 pb-1">
                              Relay metadata
                            </h5>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Relay Node:</span>
                                <span className="text-foreground font-mono text-[10px]">
                                  {selectedRecord.relayNode}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Routing Latency:</span>
                                <span className="text-foreground font-semibold">
                                  {selectedRecord.latency}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Relay Diag ID:</span>
                                <button
                                  onClick={() =>
                                    copyToClipboard(selectedRecord.diagnosticId, "Diagnostic ID")
                                  }
                                  className="font-mono text-[9px] text-foreground/80 hover:underline flex items-center gap-0.5"
                                >
                                  {selectedRecord.diagnosticId.slice(0, 12)}...
                                  <Copy className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Diagnostic JSON Copy report */}
                        <button
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(
                                {
                                  ...selectedRecord,
                                  email: undefined, // exclude sensitive email object
                                },
                                null,
                                2,
                              ),
                              "Proof diagnostic report",
                            )
                          }
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] py-2 text-xs font-semibold text-foreground transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/10"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy Proof Diagnostic Report
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Modal Footer CTAs */}
            <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-4 bg-white/[0.01]">
              <div className="flex items-center gap-2">
                {selectedRecord && hasSearched && !isSearching && (
                  <>
                    <a
                      href={`https://stellar.expert/explorer/public/tx/${selectedRecord.paymentHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-white/10"
                    >
                      Stellar.Expert
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => {
                        onOpenMessage(selectedRecord.email);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Open Message
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
