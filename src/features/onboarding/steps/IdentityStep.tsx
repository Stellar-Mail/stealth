import { ExternalLink, Loader2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FreighterHook } from "../useFreighter";
import type { OnboardingDraft } from "../types";

type Props = {
  freighter: FreighterHook;
  onAdvance: (patch: Partial<OnboardingDraft>) => void;
};

/**
 * Step 1: Connect Wallet
 *
 * Requests Freighter access and stores the returned G-address in the draft.
 * Every wallet request explicitly explains its intent before triggering any popup.
 */
export function IdentityStep({ freighter, onAdvance }: Props) {
  const { state, connect } = freighter;

  async function handleConnect() {
    const address = await connect();
    if (address) {
      onAdvance({ walletAddress: address });
    }
  }

  const isConnecting = state.status === "connecting";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Connect your wallet</h2>
        <p className="text-sm text-muted-foreground">
          Your Stellar wallet is your cryptographic identity on Stealth. No transaction will be
          signed during this step — we are only reading your public key.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">What Stealth will read</p>
            <p className="text-xs text-muted-foreground">
              Your Stellar public key (G-address). Nothing else is accessed or stored remotely.
            </p>
          </div>
        </div>
      </div>

      {state.status === "unavailable" && (
        <div
          role="status"
          className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4"
        >
          <p className="text-sm text-amber-300">
            Freighter wallet extension not found. Install it, then return here.
          </p>
          <a
            href="https://freighter.app"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-sm text-xs text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
          >
            Get Freighter <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4">
          <p className="text-sm text-red-300">{state.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">You can try again below.</p>
        </div>
      )}

      {state.status === "connected" && (
        <div
          role="status"
          className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4"
        >
          <p className="text-xs font-mono text-emerald-300 break-all">{state.address}</p>
          <p className="mt-1 text-xs text-muted-foreground">Wallet connected. Continuing…</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleConnect}
        disabled={isConnecting || state.status === "connected"}
        aria-busy={isConnecting}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.99]",
          isConnecting || state.status === "connected"
            ? "cursor-not-allowed bg-white/10 text-muted-foreground"
            : "bg-foreground text-background hover:opacity-90",
        )}
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for Freighter…
          </>
        ) : state.status === "connected" ? (
          "Connected"
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            Connect with Freighter
          </>
        )}
      </button>
    </div>
  );
}
