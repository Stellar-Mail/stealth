import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Shield,
  Wallet,
  XCircle,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSenderRequest } from "./useSenderRequest";
import {
  SENDER_REQUEST_STEPS,
  stepIndex,
  type DeliveryOutcome,
  type PostageSubmission,
  type SenderIdentity,
} from "./types";

// ─── Motion ──────────────────────────────────────────────────────────────────

const stepVariants: Variants = {
  enter: (d: number) => ({ x: d * 24, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } },
  exit: (d: number) => ({ x: d * -24, opacity: 0, transition: { duration: 0.15 } }),
};

// ─── Primitives ──────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3 pb-2" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-0.5 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= current ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.1)" }}
          />
        ))}
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
        {current + 1} / {total}
      </span>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2.5 text-xs text-rose-400">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className="flex-1 leading-relaxed">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-medium underline underline-offset-2 hover:no-underline">
          Retry
        </button>
      )}
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  loading,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/90 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      Back
    </button>
  );
}

// ─── Step: AddressLookup ─────────────────────────────────────────────────────

function AddressLookupStep({
  loading,
  error,
  onSubmit,
}: {
  loading: boolean;
  error: string | null;
  onSubmit: (address: string) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState("");
  const valid = value.trim().length > 3;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(value.trim()); }}
      className="flex flex-col gap-4"
    >
      <div>
        <h2 className="text-base font-semibold text-foreground">Send a message</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter the recipient's Stealth address or Stellar G-address to see their delivery policy.
          No account needed to get started.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
          Recipient address
        </label>
        <input
          id={inputId}
          type="text"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="alice@stealth.im or GABC…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/15"
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <PrimaryButton type="submit" disabled={!valid} loading={loading}>
        Look up policy
      </PrimaryButton>
    </form>
  );
}

// ─── Step: PolicyQuote ───────────────────────────────────────────────────────

function PolicyQuoteStep({
  displayHandle,
  quote,
  loading,
  error,
  onAccept,
  onBack,
}: {
  displayHandle: string;
  quote: { amount: string; amountXlm: string; eligible: boolean; reason: string; trusted: boolean };
  loading: boolean;
  error: string | null;
  onAccept: () => void;
  onBack: () => void;
}) {
  const isFree = quote.trusted || quote.amount === "0";
  const isBlocked = !quote.eligible;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Delivery policy</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Review the terms before connecting your wallet. No surprises after this step.
        </p>
      </div>

      <dl className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Recipient</dt>
          <dd className="max-w-[60%] truncate text-right font-mono text-foreground/80">{displayHandle}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Postage required</dt>
          <dd className={cn(
            "font-semibold",
            isFree && "text-emerald-400",
            isBlocked && "text-rose-400",
            !isFree && !isBlocked && "text-foreground",
          )}>
            {isBlocked ? "Blocked" : isFree ? "Free" : `${quote.amountXlm} XLM`}
          </dd>
        </div>
        {!isFree && !isBlocked && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Refund</dt>
            <dd className="text-foreground/70">Full refund if blocked</dd>
          </div>
        )}
      </dl>

      {isBlocked ? (
        <ErrorBanner message="This recipient has blocked your address. You cannot send them a message at this time." />
      ) : (
        <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
          {isFree
            ? "You are on this recipient's allow-list. No postage required — proceed to verify your identity."
            : `You will attach ${quote.amountXlm} XLM as postage proof. If the recipient blocks your message, the full amount is returned to your Stellar wallet within 24 hours.`}
        </p>
      )}

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-col gap-2">
        {!isBlocked && (
          <PrimaryButton onClick={onAccept} loading={loading}>
            {isFree ? "Continue" : "Accept terms and continue"}
          </PrimaryButton>
        )}
        <BackButton onClick={onBack} />
      </div>
    </div>
  );
}

// ─── Step: IdentityProof ─────────────────────────────────────────────────────

function IdentityProofStep({
  loading,
  error,
  onConnect,
  onBack,
}: {
  loading: boolean;
  error: string | null;
  onConnect: (identity: SenderIdentity) => void;
  onBack: () => void;
}) {
  const inputId = useId();
  const [manualAddress, setManualAddress] = useState("");
  const [showManual, setShowManual] = useState(false);

  const manualValid = /^G[A-Z2-7]{55}$/.test(manualAddress.trim());

  const handleFreighter = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const freighter = (window as any).freighter;
      if (!freighter) { setShowManual(true); return; }
      await freighter.setAllowed();
      const address: string = await freighter.getPublicKey();
      onConnect({ address, method: "freighter" });
    } catch {
      setShowManual(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Verify your identity</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect your Stellar wallet so the recipient can verify who you are. Your private key
          never leaves your device.
        </p>
      </div>

      {!showManual ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleFreighter}
            disabled={loading}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-foreground transition hover:bg-white/[0.07] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            <Wallet className="size-4 shrink-0 text-blue-400" aria-hidden />
            <span className="flex-1 text-left">Connect Freighter wallet</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Recommended</span>
          </button>

          <button
            onClick={() => setShowManual(true)}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-white/[0.03] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            <Shield className="size-4 shrink-0" aria-hidden />
            Enter Stellar address manually
          </button>

          <p className="text-[10px] text-center text-muted-foreground/60">
            No Stellar account? <a href="https://stellar.org/learn/intro-to-stellar" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground">Learn how to get one free.</a>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
              Your Stellar G-address
            </label>
            <input
              id={inputId}
              autoFocus
              type="text"
              spellCheck={false}
              placeholder="GABC… (56 characters)"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              aria-invalid={manualAddress.length > 0 && !manualValid}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/15"
            />
            {manualAddress.length > 0 && !manualValid && (
              <p className="text-[10px] text-rose-400">Must be a valid Stellar G-address (starts with G, 56 characters)</p>
            )}
          </div>
          <PrimaryButton
            disabled={!manualValid}
            loading={loading}
            onClick={() => onConnect({ address: manualAddress.trim(), method: "manual" })}
          >
            Continue
          </PrimaryButton>
          <button
            onClick={() => setShowManual(false)}
            className="text-xs text-center text-muted-foreground hover:text-foreground"
          >
            ← Back to wallet options
          </button>
        </div>
      )}

      {error && <ErrorBanner message={error} />}
      <BackButton onClick={onBack} />
    </div>
  );
}

// ─── Step: PostagePayment ────────────────────────────────────────────────────

function PostagePaymentStep({
  quote,
  senderAddress,
  loading,
  error,
  onSubmit,
  onBack,
}: {
  quote: { amountXlm: string; amount: string };
  senderAddress: string;
  loading: boolean;
  error: string | null;
  onSubmit: (submission: PostageSubmission) => void;
  onBack: () => void;
}) {
  const isFree = quote.amount === "0";
  const txInputId = useId();
  const [txHash, setTxHash] = useState("");
  const hashValid = isFree || /^[a-f0-9]{64}$/i.test(txHash.trim());

  const handleSubmit = () => {
    // Generate a deterministic message ID from timestamp + random bytes
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const messageId = Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("");
    onSubmit({
      messageId,
      paymentHash: isFree ? "0".repeat(64) : txHash.trim().toLowerCase(),
      amount: quote.amount,
      submittedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {isFree ? "Confirm your message" : "Attach postage"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {isFree
            ? "No postage required. Confirm to deliver your message."
            : `Send ${quote.amountXlm} XLM on the Stellar network, then paste the transaction hash below.`}
        </p>
      </div>

      <dl className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">From</dt>
          <dd className="max-w-[55%] truncate font-mono text-foreground/80">{senderAddress}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Postage</dt>
          <dd className={cn("font-semibold", isFree ? "text-emerald-400" : "text-foreground")}>
            {isFree ? "Free" : `${quote.amountXlm} XLM`}
          </dd>
        </div>
        {!isFree && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Refund policy</dt>
            <dd className="text-foreground/70">Full refund if blocked</dd>
          </div>
        )}
      </dl>

      {!isFree && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={txInputId} className="text-xs font-medium text-muted-foreground">
            Transaction hash
          </label>
          <input
            id={txInputId}
            type="text"
            spellCheck={false}
            placeholder="64-character hexadecimal hash"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            aria-invalid={txHash.length > 0 && !hashValid}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/15"
          />
          <p className="text-[10px] text-muted-foreground">
            Copy from your Stellar wallet after sending. Postage is non-custodial — the relay verifies but never holds your funds.
          </p>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-col gap-2">
        <PrimaryButton disabled={!hashValid} loading={loading} onClick={handleSubmit}>
          {isFree ? "Send message" : "Submit postage proof"}
        </PrimaryButton>
        <BackButton onClick={onBack} />
      </div>
    </div>
  );
}

// ─── Step: DeliveryStatus ─────────────────────────────────────────────────────

function DeliveryStatusStep({
  outcome,
  onSimulateOutcome,
  onReset,
}: {
  outcome: DeliveryOutcome | null;
  onSimulateOutcome: (o: DeliveryOutcome) => void;
  onReset: () => void;
}) {
  const isPending = !outcome || outcome.state === "pending";
  const isSettled = outcome?.state === "settled";
  const isRefunded = outcome?.state === "refunded";
  const isError = outcome?.state === "error";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Delivery status</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Your message has been submitted. The relay is verifying your postage proof.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {isPending && (
          <motion.div
            key="pending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-6 text-center"
            aria-live="polite"
          >
            <Clock className="size-8 text-amber-400/80" aria-hidden />
            <p className="text-sm font-medium text-foreground/80">Awaiting confirmation</p>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              Verification usually takes a few seconds. Keep this window open.
            </p>
            {/* Demo controls — remove in production */}
            <div className="flex gap-2 pt-2" aria-label="Demo: simulate outcome">
              <button
                onClick={() => onSimulateOutcome({ state: "settled" })}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
              >
                Simulate delivered
              </button>
              <button
                onClick={() => onSimulateOutcome({ state: "refunded", reason: "Sender blocked by recipient" })}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30"
              >
                Simulate refund
              </button>
            </div>
          </motion.div>
        )}

        {isSettled && (
          <motion.div
            key="settled"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-6 text-center"
            aria-live="polite"
          >
            <CheckCircle2 className="size-8 text-emerald-400" aria-hidden />
            <p className="text-sm font-medium text-foreground/80">Message delivered</p>
            <p className="text-xs text-muted-foreground">
              Your message reached the recipient and postage was settled.
            </p>
            <button
              onClick={onReset}
              className="mt-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              Send another message
            </button>
          </motion.div>
        )}

        {isRefunded && (
          <motion.div
            key="refunded"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-6 text-center"
            aria-live="polite"
          >
            <BadgeCheck className="size-8 text-blue-400" aria-hidden />
            <p className="text-sm font-medium text-foreground/80">Postage refunded</p>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              {(outcome as { state: "refunded"; reason: string }).reason}.{" "}
              Your postage has been returned to your Stellar wallet.
            </p>
            <button
              onClick={onReset}
              className="mt-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              Try again
            </button>
          </motion.div>
        )}

        {isError && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-6 text-center"
            role="alert"
          >
            <XCircle className="size-8 text-rose-400" aria-hidden />
            <p className="text-sm font-medium text-foreground/80">Delivery failed</p>
            <p className="text-xs text-muted-foreground">
              {(outcome as { state: "error"; message: string }).message}
            </p>
            <button
              onClick={onReset}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              <RefreshCw className="size-3" aria-hidden />
              Start over
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Root Orchestrator ────────────────────────────────────────────────────────

/**
 * SenderRequestFlow
 *
 * Self-contained external sender journey rendered inside a container you
 * control (typically the /send route's centered card).
 *
 * Acceptance criteria:
 * - No prior crypto knowledge required: each step explains what it needs.
 * - Price and refund terms shown before any commitment (policy-quote step).
 * - Wallet/balance failures are recoverable: manual address fallback + retry.
 * - ARIA roles and live regions for screen readers.
 */
export function SenderRequestFlow() {
  const {
    state,
    advance,
    retreat,
    resolveAddress,
    connectIdentity,
    submitPayment,
    resolveDelivery,
    reset,
  } = useSenderRequest();

  const { step, direction, loading, error, resolution, quote, identity, outcome } = state;

  const current = stepIndex(step);
  const total = SENDER_REQUEST_STEPS.length;

  return (
    <div className="flex flex-col gap-5">
      <ProgressBar current={current} total={total} />

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          {step === "address-lookup" && (
            <AddressLookupStep
              loading={loading}
              error={error}
              onSubmit={resolveAddress}
            />
          )}

          {step === "policy-quote" && quote && resolution && (
            <PolicyQuoteStep
              displayHandle={resolution.displayHandle}
              quote={quote}
              loading={loading}
              error={error}
              onAccept={advance}
              onBack={retreat}
            />
          )}

          {step === "identity-proof" && (
            <IdentityProofStep
              loading={loading}
              error={error}
              onConnect={connectIdentity}
              onBack={retreat}
            />
          )}

          {step === "postage-payment" && quote && identity && (
            <PostagePaymentStep
              quote={quote}
              senderAddress={identity.address}
              loading={loading}
              error={error}
              onSubmit={submitPayment}
              onBack={retreat}
            />
          )}

          {(step === "delivery-status" || step === "refund-outcome") && (
            <DeliveryStatusStep
              outcome={outcome}
              onSimulateOutcome={resolveDelivery}
              onReset={reset}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
