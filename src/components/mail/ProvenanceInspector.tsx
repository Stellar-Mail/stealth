import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, FileJson, Cpu } from "lucide-react";
import { useState } from "react";
import type { ProvenanceItemDetails } from "./provenance";

export function ProvenanceInspector({
  open,
  onClose,
  details,
  onShowToast,
}: {
  open: boolean;
  onClose: () => void;
  details: ProvenanceItemDetails | null;
  onShowToast?: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyJson = async () => {
    if (!details) return;
    try {
      await navigator.clipboard.writeText(details.rawJson);
      setCopied(true);
      onShowToast?.("JSON data copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy JSON:", err);
    }
  };

  return (
    <AnimatePresence>
      {open && details && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="glass-modal fixed left-1/2 top-1/2 z-[60] w-[min(540px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-300" />
                <h3 className="text-sm font-semibold text-foreground">{details.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="scrollbar-thin max-h-[calc(80vh-120px)] overflow-y-auto p-5 space-y-5">
              <p className="text-xs leading-relaxed text-muted-foreground/90">
                {details.description}
              </p>

              {/* Technical key-value list */}
              <div className="rounded-xl border border-white/[0.06] bg-black/15 overflow-hidden">
                <div className="divide-y divide-white/[0.05]">
                  {details.keyValuePairs.map((pair, idx) => (
                    <div key={idx} className="grid grid-cols-[140px_1fr] p-3 gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground self-center">
                        {pair.label}
                      </span>
                      <span
                        className={`text-xs text-foreground/90 break-all leading-normal ${
                          pair.isCode
                            ? "font-mono bg-white/[0.03] px-1 py-0.5 rounded border border-white/[0.04]"
                            : ""
                        }`}
                      >
                        {pair.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw JSON viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <FileJson className="h-3 w-3" />
                    <span>Raw Verification Record (JSON)</span>
                  </div>
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-muted-foreground transition hover:border-white/20 hover:text-foreground hover:bg-white/[0.08]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="scrollbar-thin overflow-auto rounded-xl border border-white/[0.06] bg-black/25 p-3.5 font-mono text-[11px] leading-relaxed text-foreground/80 max-h-56">
                  {details.rawJson}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-white/5 px-5 py-3.5 bg-black/10">
              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/[0.08] hover:border-white/20"
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
