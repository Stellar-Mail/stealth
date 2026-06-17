import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Ban,
  Copy,
  Download,
  Eye,
  File,
  FileArchive,
  FileText,
  Image,
  KeyRound,
  Loader2,
  Lock,
  Paperclip,
  ShieldBan,
  ShieldCheck,
  ShieldOff,
  Braces,
  Table2,
  Check,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AttachmentInfo, AttachmentRiskState, AttachmentOrigin, AttachmentActions } from "./types";

const RISK_STATE_META: Record<AttachmentRiskState, { label: string; icon: LucideIcon; className: string }> = {
  scanning: {
    label: "Scanning",
    icon: Loader2,
    className: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  },
  verified: {
    label: "Verified",
    icon: ShieldCheck,
    className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  },
  blocked: {
    label: "Blocked",
    icon: ShieldOff,
    className: "border-red-300/25 bg-red-300/10 text-red-200",
  },
  failed: {
    label: "Failed",
    icon: AlertTriangle,
    className: "border-orange-300/25 bg-orange-300/10 text-orange-200",
  },
};

const ORIGIN_META: Record<AttachmentOrigin, { label: string; className: string }> = {
  known: {
    label: "Known",
    className: "border-sky-300/25 bg-sky-300/10 text-sky-200",
  },
  encrypted: {
    label: "Encrypted",
    className: "border-teal-300/25 bg-teal-300/10 text-teal-200",
  },
  unknown: {
    label: "Unknown",
    className: "border-zinc-300/20 bg-zinc-300/10 text-zinc-200",
  },
};

function getAttachmentIcon(type: string): { icon: LucideIcon; className: string } {
  const t = type.toLowerCase();
  if (t === "pdf") return { icon: FileText, className: "text-red-300" };
  if (t === "key") return { icon: KeyRound, className: "text-sky-200" };
  if (t === "json") return { icon: Braces, className: "text-emerald-200" };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(t))
    return { icon: Image, className: "text-violet-200" };
  if (["zip", "rar", "7z"].includes(t))
    return { icon: FileArchive, className: "text-amber-200" };
  if (["xls", "xlsx", "csv"].includes(t))
    return { icon: Table2, className: "text-green-200" };
  if (["exe", "bin", "dmg", "msi", "sh", "bat", "cmd", "vbs", "ps1"].includes(t))
    return { icon: Ban, className: "text-red-300" };
  if (["enc", "pgp", "gpg", "payload"].includes(t))
    return { icon: Lock, className: "text-amber-300" };
  return { icon: File, className: "text-slate-200" };
}

function formatChecksum(checksum: string): string {
  if (checksum.length <= 12) return checksum;
  return `${checksum.slice(0, 8)}...${checksum.slice(-4)}`;
}

interface UnsafeConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function UnsafeConfirm({ onConfirm, onCancel }: UnsafeConfirmProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-orange-300/20 bg-orange-300/[0.04] px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-200" />
        <span className="text-[11px] text-orange-100/90">This file was flagged as unsafe.</span>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={onCancel}
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-orange-300 px-2 py-1 text-[10px] font-semibold text-black transition hover:opacity-90"
          >
            Download anyway
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function AttachmentPanel({
  attachments,
  actions = {},
}: {
  attachments: AttachmentInfo[];
  actions?: AttachmentActions;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  if (!attachments.length) return null;

  const handleCopyHash = async (att: AttachmentInfo) => {
    await navigator.clipboard.writeText(att.checksum);
    setCopiedHash(att.name);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleDownload = (att: AttachmentInfo) => {
    setConfirming(null);
    const text = `Mock content for ${att.name}\nSize: ${att.size}\nChecksum: ${att.checksum}`;
    const blob = new Blob([text], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = att.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadClick = (att: AttachmentInfo) => {
    if (att.riskState === "blocked" || att.riskState === "failed") {
      setConfirming(att.name);
      return;
    }
    handleDownload(att);
  };

  const isUnsafe = (state: AttachmentRiskState) => state === "blocked" || state === "failed";

  return (
    <div className="mt-7 max-w-[500px]">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <Paperclip className="h-3 w-3" />
        <span>{attachments.length} attachment{attachments.length > 1 ? "s" : ""}</span>
      </div>
      <div className="grid max-w-[460px] grid-cols-1 gap-2">
        {attachments.map((att) => {
          const { icon: Icon, className: iconClass } = getAttachmentIcon(att.type);
          const riskMeta = RISK_STATE_META[att.riskState];
          const originMeta = ORIGIN_META[att.origin];
          const RiskIcon = riskMeta.icon;
          const isConfirming = confirming === att.name;
          const canPreview = att.riskState === "verified";
          const canDownload = att.riskState === "verified" || isUnsafe(att.riskState);
          const canQuarantine = att.riskState !== "blocked";

          return (
            <motion.div
              key={att.name}
              layout
              className={cn(
                "glass-tile rounded-md border transition-all duration-150",
                att.riskState === "blocked" && "border-red-300/10 bg-red-300/[0.02]",
                att.riskState === "failed" && "border-orange-300/10 bg-orange-300/[0.02]",
                att.riskState === "scanning" && "border-amber-300/5",
              )}
            >
              <div
                role="group"
                aria-label={`Attachment: ${att.name}, ${att.size}, risk: ${riskMeta.label}, origin: ${originMeta.label}`}
                className="px-3 py-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/[0.1] bg-white/[0.06] shadow-[inset_0_1px_0_oklch(1_0_0/0.12)]">
                    <Icon className={cn("h-4 w-4", iconClass)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-semibold leading-[14px] text-foreground/92">
                        {att.name}
                      </span>
                      <span className="shrink-0 text-[9.5px] text-muted-foreground">
                        {att.size}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-[9.5px] text-muted-foreground/70">
                        {formatChecksum(att.checksum)}
                      </span>
                      <button
                        onClick={() => handleCopyHash(att)}
                        aria-label={`Copy checksum for ${att.name}`}
                        className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-muted-foreground/60 transition hover:bg-white/[0.06] hover:text-foreground/80"
                      >
                        {copiedHash === att.name ? (
                          <Check className="h-2.5 w-2.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                        <span className="sr-only">Copy hash</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none",
                        originMeta.className,
                      )}
                    >
                      {originMeta.label}
                    </span>
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none",
                              riskMeta.className,
                            )}
                            aria-label={`Risk: ${riskMeta.label}`}
                          >
                            <RiskIcon
                              className={cn(
                                "h-2.5 w-2.5",
                                att.riskState === "scanning" && "animate-spin",
                              )}
                              aria-hidden
                            />
                            <span>{riskMeta.label}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[11px]">
                          {att.riskState === "scanning" && "Attachment is being scanned for threats."}
                          {att.riskState === "verified" && "Attachment passed security scan."}
                          {att.riskState === "blocked" && "Attachment was flagged as unsafe."}
                          {att.riskState === "failed" && "Security scan could not complete."}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {canPreview && actions.onPreview && (
                    <button
                      onClick={() => actions.onPreview!(att)}
                      aria-label={`Preview ${att.name}`}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
                    >
                      <Eye className="h-3 w-3" aria-hidden />
                      <span>Preview</span>
                    </button>
                  )}
                  {canDownload && (
                    <button
                      onClick={() => handleDownloadClick(att)}
                      disabled={att.riskState === "scanning"}
                      aria-label={`Download ${att.name}`}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition",
                        att.riskState === "blocked" || att.riskState === "failed"
                          ? "border-orange-300/20 bg-orange-300/[0.06] text-orange-200 hover:bg-orange-300/[0.12]"
                          : "border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground",
                        att.riskState === "scanning" && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <Download className="h-3 w-3" aria-hidden />
                      <span>{isUnsafe(att.riskState) ? "Download anyway" : "Download"}</span>
                    </button>
                  )}
                  {att.riskState === "scanning" && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1 text-[10px] text-muted-foreground/60">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      <span>Scanning...</span>
                    </span>
                  )}
                  {canQuarantine && actions.onQuarantine && att.riskState !== "blocked" && (
                    <button
                      onClick={() => actions.onQuarantine!(att)}
                      aria-label={`Quarantine ${att.name}`}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300/15 bg-red-300/[0.04] px-2 py-1 text-[10px] text-red-200/80 transition hover:bg-red-300/[0.1] hover:text-red-200"
                    >
                      <ShieldBan className="h-3 w-3" aria-hidden />
                      <span>Quarantine</span>
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {isConfirming && (
                    <UnsafeConfirm
                      onConfirm={() => handleDownload(att)}
                      onCancel={() => setConfirming(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
