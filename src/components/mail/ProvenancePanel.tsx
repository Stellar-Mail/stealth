import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Search,
  ChevronDown,
  Server,
  Fingerprint,
  Database,
  Lock,
  Coins,
  Receipt,
  Check,
  type LucideIcon,
} from "lucide-react";
import {
  getEmailProvenance,
  type ProvenanceDetails,
  type ProvenanceItemDetails,
  type ProvenanceTimelineItem,
} from "./provenance";
import { ProvenanceInspector } from "./ProvenanceInspector";
import { PostageDisputePanel, type PostageDisputeStatus } from "./PostageDisputePanel";
import type { Email } from "./data";

/** Map provenance status strings to the contract PostageStatus enum values. */
function deriveDisputeStatus(status: string): PostageDisputeStatus {
  const s = status.toLowerCase();
  if (s.includes("escrow") || s.includes("pending")) return "pending";
  if (s.includes("settled")) return "settled";
  if (s.includes("refund")) return "refunded";
  if (s.includes("reclaim")) return "reclaimed";
  if (s.includes("disput")) return "disputed";
  if (s.includes("expire")) return "expired";
  return "pending";
}

export function ProvenancePanel({
  email,
  onShowToast,
  compact = false,
}: {
  email: Email | null;
  onShowToast?: (message: string) => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [inspectItem, setInspectItem] = useState<ProvenanceItemDetails | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!email) {
    return (
      <div className="text-center py-6 text-xs text-muted-foreground">
        Select a message to view cryptographic provenance.
      </div>
    );
  }

  const provenance = getEmailProvenance(email);

  const getTimelineIcon = (step: ProvenanceTimelineItem["key"]) => {
    switch (step) {
      case "senderIdentity":
        return Fingerprint;
      case "relaySource":
        return Server;
      case "messageHash":
        return Database;
      case "payloadCommitment":
        return Lock;
      case "postageRecord":
        return Coins;
      case "receiptRecord":
        return Receipt;
      default:
        return Shield;
    }
  };

  const handleCopy = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      onShowToast?.(`${label} copied to clipboard`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isVerified = provenance.senderIdentity.isVerified;

  // Render a single field row inside the detailed panel
  const FieldRow = ({
    fieldKey,
    label,
    icon: Icon,
    displayValue,
    rawValue,
    details,
    inspectorData,
  }: {
    fieldKey: string;
    label: string;
    icon: LucideIcon;
    displayValue: string;
    rawValue: string;
    details?: string;
    inspectorData: ProvenanceItemDetails;
  }) => {
    const isCopied = copiedKey === fieldKey;

    return (
      <div className="flex flex-col gap-1 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5 transition hover:bg-white/[0.04]">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => handleCopy(fieldKey, rawValue, label)}
              className="rounded p-1 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              title={`Copy ${label}`}
            >
              {isCopied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={() => setInspectItem(inspectorData)}
              className="rounded p-1 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              title={`Inspect ${label}`}
            >
              <Search className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-0.5">
          <span className="font-mono text-xs text-foreground/90 font-medium break-all select-all">
            {displayValue}
          </span>
        </div>

        {details && (
          <span className="text-[10px] text-muted-foreground/70 leading-relaxed truncate">
            {details}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* High-level status header */}
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-3">
        <div className="mt-0.5 shrink-0">
          {isVerified ? (
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
          ) : email.folder === "spam" ? (
            <ShieldAlert className="h-5 w-5 text-red-300" />
          ) : (
            <Shield className="h-5 w-5 text-amber-200" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              {isVerified
                ? "Secure On-Chain Route"
                : email.folder === "spam"
                  ? "SMTP Bridged (Unverified)"
                  : "Awaiting Envelope Proof"}
            </span>
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground/90">
            {isVerified
              ? `Delivered via ${provenance.relaySource.nodeId} with a verified postage record.`
              : email.folder === "spam"
                ? "Bridged message without Stellar cryptographic signatures."
                : "Message processed but security verification is currently in progress."}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/10 p-3">
        <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Proof Timeline</span>
          <span>
            {provenance.timeline.filter((item) => item.status === "complete").length}/
            {provenance.timeline.length} complete
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {provenance.timeline.map((item, index) => {
            const Icon = getTimelineIcon(item.key);
            const statusStyles =
              item.status === "complete"
                ? "border-emerald-500 bg-emerald-500 text-black"
                : item.status === "pending"
                  ? "border-amber-300 bg-amber-300 text-black"
                  : "border-white/10 bg-white/10 text-muted-foreground";

            return (
              <div key={item.key} className="grid grid-cols-[auto_1fr] gap-3">
                <div className="relative flex flex-col items-center">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full border ${statusStyles}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {index < provenance.timeline.length - 1 && (
                    <span className="absolute top-10 left-1/2 h-full w-px -translate-x-1/2 bg-white/[0.08]" />
                  )}
                </div>
                <div className="border-b border-white/[0.04] pb-3 last:border-none last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{item.title}</div>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {item.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Accordion Toggle for Progressive Disclosure */}
      <div className="border-t border-white/[0.06] pt-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
        >
          <span>Technical Provenance</span>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pb-2 pt-1.5">
                <FieldRow
                  fieldKey="sender"
                  label="Sender Identity"
                  icon={Fingerprint}
                  displayValue={provenance.senderIdentity.resolvedFormatted}
                  rawValue={provenance.senderIdentity.resolved}
                  details={provenance.senderIdentity.provider}
                  inspectorData={provenance.senderIdentity.inspector}
                />
                <FieldRow
                  fieldKey="relay"
                  label="Relay Source"
                  icon={Server}
                  displayValue={provenance.relaySource.domain}
                  rawValue={provenance.relaySource.pubkey}
                  details={`Node: ${provenance.relaySource.nodeId}`}
                  inspectorData={provenance.relaySource.inspector}
                />
                <FieldRow
                  fieldKey="msgHash"
                  label="Message Hash"
                  icon={Database}
                  displayValue={provenance.messageHash.formatted}
                  rawValue={provenance.messageHash.raw}
                  details={`${provenance.messageHash.algorithm} • ${provenance.messageHash.sizeBytes} B`}
                  inspectorData={provenance.messageHash.inspector}
                />
                <FieldRow
                  fieldKey="commitment"
                  label="Payload Commitment"
                  icon={Lock}
                  displayValue={provenance.payloadCommitment.formatted}
                  rawValue={provenance.payloadCommitment.raw}
                  details={provenance.payloadCommitment.encryptionScheme}
                  inspectorData={provenance.payloadCommitment.inspector}
                />
                <FieldRow
                  fieldKey="postage"
                  label="Postage Record"
                  icon={Coins}
                  displayValue={provenance.postageRecord.amount}
                  rawValue={provenance.postageRecord.txHash}
                  details={provenance.postageRecord.status}
                  inspectorData={provenance.postageRecord.inspector}
                />
                <PostageDisputePanel
                  postageStatus={deriveDisputeStatus(provenance.postageRecord.status)}
                  amountXlm={provenance.postageRecord.amount.replace(/[^0-9.]/g, "") || undefined}
                />
                <FieldRow
                  fieldKey="receipt"
                  label="Receipt Record"
                  icon={Receipt}
                  displayValue={provenance.receiptRecord.contractIdFormatted}
                  rawValue={provenance.receiptRecord.contractId}
                  details={provenance.receiptRecord.status}
                  inspectorData={provenance.receiptRecord.inspector}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Internal Inspector Modal */}
      <ProvenanceInspector
        open={inspectItem !== null}
        onClose={() => setInspectItem(null)}
        details={inspectItem}
        onShowToast={onShowToast}
      />
    </div>
  );
}
