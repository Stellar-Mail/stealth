import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, FileJson, Cpu } from "lucide-react";
import { useState } from "react";
import type { ProvenanceItemDetails } from "./provenance";
import { motionPresets } from "@/lib/motion-presets";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { copyFieldAriaLabel } from "./provenance-a11y";

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
  const dialogRef = useFocusTrap(open && details !== null, onClose);
  const headingId = "provenance-inspector-title";

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
            {...motionPresets.patterns.modal.backdrop}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            {...motionPresets.patterns.modal.content}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            tabIndex={-1}
            className="glass-modal fixed left-1/2 top-1/2 z-[60] w-[min(540px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl focus:outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                <h3 id={headingId} className="text-sm font-semibold text-foreground">
                  {details.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-white/10"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Content Body */}
            <div className="scrollbar-thin max-h-[calc(80vh-120px)] overflow-y-auto p-5 space-y-5">
              <p className="text-xs leading-relaxed text-muted-foreground/90">
                {details.description}
              </p>

              {/* Technical key-value list */}
              <div
                className="rounded-xl border border-white/[0.06] bg-black/15 overflow-hidden"
                role="region"
                aria-label="Verification fields"
              >
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
                    <FileJson className="h-3 w-3" aria-hidden="true" />
                    <span>Raw Verification Record (JSON)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    aria-label={copyFieldAriaLabel("raw JSON record", copied)}
                    aria-pressed={copied}
                    className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-muted-foreground transition hover:border-white/20 hover:text-foreground hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/10"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre
                  className="scrollbar-thin overflow-auto rounded-xl border border-white/[0.06] bg-black/25 p-3.5 font-mono text-[11px] leading-relaxed text-foreground/80 max-h-56"
                  aria-label="Raw verification JSON"
                >
                  {details.rawJson}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-white/5 px-5 py-3.5 bg-black/10">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/[0.08] hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
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
