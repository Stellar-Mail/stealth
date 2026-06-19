import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCheck, KeyRound, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EncryptedPayload, PayloadFailureReason } from "./data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function failureCopy(reason: PayloadFailureReason | undefined): {
  headline: string;
  detail: string;
} {
  switch (reason) {
    case "key":
      return {
        headline: "Key not found",
        detail: "The decryption key for this payload is missing or expired.",
      };
    case "payload":
      return {
        headline: "Payload unreadable",
        detail: "The encrypted payload could not be decoded. It may be malformed.",
      };
    case "relay":
      return {
        headline: "Relay error",
        detail: "The relay returned an error while fetching the encrypted payload.",
      };
    case "integrity":
      return {
        headline: "Integrity check failed",
        detail: "The payload hash does not match. Possible tampering detected.",
      };
    default:
      return {
        headline: "Decryption failed",
        detail: "An unknown error prevented decryption of this payload.",
      };
  }
}

// Reduced-motion-aware animation variant factory.
function bannerVariants(reducedMotion: boolean) {
  const duration = reducedMotion ? 0 : 0.25;
  return {
    initial: { opacity: 0, y: reducedMotion ? 0 : -6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reducedMotion ? 0 : -6 },
    transition: { duration, ease: [0.2, 0.8, 0.2, 1] as const },
  };
}

// ---------------------------------------------------------------------------
// Sub-state banners
// ---------------------------------------------------------------------------

function LockedBanner({
  diagnosticId,
  onUnlock,
  reducedMotion,
}: {
  diagnosticId: string;
  onUnlock?: () => void;
  reducedMotion: boolean;
}) {
  const variants = bannerVariants(reducedMotion);
  return (
    <motion.div
      {...variants}
      data-testid="encrypted-banner-locked"
      className="mt-5 flex items-center gap-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.05] px-3 py-2.5"
    >
      <motion.div
        animate={reducedMotion ? {} : { scale: [1, 1.12, 1] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
      >
        <KeyRound className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
      </motion.div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground">Payload locked</div>
        <div className="font-mono text-[10px] text-muted-foreground truncate">
          ID: {diagnosticId}
        </div>
      </div>
      {onUnlock && (
        <button
          onClick={onUnlock}
          className="shrink-0 rounded-md border border-sky-400/20 bg-sky-400/[0.08] px-2.5 py-1 text-[10px] font-medium text-sky-200 transition hover:bg-sky-400/[0.14]"
        >
          Unlock
        </button>
      )}
    </motion.div>
  );
}

function VerifyingBanner({
  diagnosticId,
  reducedMotion,
}: {
  diagnosticId: string;
  reducedMotion: boolean;
}) {
  const variants = bannerVariants(reducedMotion);
  return (
    <motion.div
      {...variants}
      data-testid="encrypted-banner-verifying"
      className="mt-5 flex items-center gap-3 rounded-lg border border-amber-200/20 bg-amber-200/[0.04] px-3 py-2.5"
    >
      <motion.div
        animate={reducedMotion ? {} : { rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
      >
        <Loader2 className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
      </motion.div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground">Verifying payload…</div>
        <div className="font-mono text-[10px] text-muted-foreground truncate">
          ID: {diagnosticId}
        </div>
      </div>
    </motion.div>
  );
}

function DecryptedBanner({
  diagnosticId,
  reducedMotion,
}: {
  diagnosticId: string;
  reducedMotion: boolean;
}) {
  const variants = bannerVariants(reducedMotion);
  return (
    <motion.div
      {...variants}
      data-testid="encrypted-banner-decrypted"
      className="mt-5 flex items-center gap-3 rounded-lg border border-emerald-200/20 bg-emerald-200/[0.04] px-3 py-2.5"
    >
      <CheckCheck className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground">Payload verified &amp; decrypted</div>
        <div className="font-mono text-[10px] text-muted-foreground truncate">
          ID: {diagnosticId}
        </div>
      </div>
    </motion.div>
  );
}

function FailedBanner({
  payload,
  onRetry,
  onCopyDiagnosticId,
  onReportCorruption,
  reducedMotion,
}: {
  payload: EncryptedPayload;
  onRetry?: () => void;
  onCopyDiagnosticId?: (id: string) => void;
  onReportCorruption?: (id: string) => void;
  reducedMotion: boolean;
}) {
  const variants = bannerVariants(reducedMotion);
  const { headline, detail } = failureCopy(payload.failureReason);

  return (
    <motion.div
      {...variants}
      data-testid="encrypted-banner-failed"
      className="mt-5 rounded-lg border border-red-300/20 bg-red-300/[0.04] px-3 py-3"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">{headline}</span>
            {payload.failureReason && (
              <span className="rounded border border-red-300/20 bg-red-300/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-red-200 uppercase tracking-wide">
                {payload.failureReason}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{detail}</p>
          <div className="font-mono text-[10px] text-muted-foreground/70 mt-1 truncate">
            ID: {payload.diagnosticId}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300/15 bg-red-300/[0.06] px-2.5 py-1 text-[10px] font-medium text-red-200 transition hover:bg-red-300/[0.12]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        )}
        {onCopyDiagnosticId && (
          <button
            onClick={() => onCopyDiagnosticId(payload.diagnosticId)}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
          >
            Copy diagnostic ID
          </button>
        )}
        {onReportCorruption && (
          <button
            onClick={() => onReportCorruption(payload.diagnosticId)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
          >
            <ShieldAlert className="h-3 w-3" aria-hidden="true" />
            Report corruption
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export type EncryptedPayloadBannerActions = {
  onUnlock?: () => void;
  onRetry?: () => void;
  onCopyDiagnosticId?: (id: string) => void;
  onReportCorruption?: (id: string) => void;
};

export function EncryptedPayloadBanner({
  payload,
  actions = {},
  className,
  reducedMotion = false,
}: {
  payload: EncryptedPayload;
  actions?: EncryptedPayloadBannerActions;
  className?: string;
  reducedMotion?: boolean;
}) {
  const { status, diagnosticId } = payload;

  return (
    <div className={cn("encrypted-payload-banner", className)}>
      <AnimatePresence mode="wait">
        {status === "locked" && (
          <LockedBanner
            key="locked"
            diagnosticId={diagnosticId}
            onUnlock={actions.onUnlock}
            reducedMotion={reducedMotion}
          />
        )}
        {status === "verifying" && (
          <VerifyingBanner
            key="verifying"
            diagnosticId={diagnosticId}
            reducedMotion={reducedMotion}
          />
        )}
        {status === "decrypted" && (
          <DecryptedBanner
            key="decrypted"
            diagnosticId={diagnosticId}
            reducedMotion={reducedMotion}
          />
        )}
        {status === "failed" && (
          <FailedBanner
            key="failed"
            payload={payload}
            onRetry={actions.onRetry}
            onCopyDiagnosticId={actions.onCopyDiagnosticId}
            onReportCorruption={actions.onReportCorruption}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
