import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";

type Props = {
  walletAddress: string;
  onAdvance: () => void;
  onRetreat: () => void;
};

/**
 * Step 3: Mailbox Address
 *
 * Displays the user's Stellar G-address as their Stealth mailbox identifier.
 * Provides a copy button so the address can be shared with contacts.
 */
export function AddressStep({ walletAddress, onAdvance, onRetreat }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Show first 8 and last 6 characters with ellipsis for the label
  const short = `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Your mailbox address</h2>
        <p className="text-sm text-muted-foreground">
          Your Stealth address is your Stellar public key. Share it with senders so they can deliver
          mail to you on-chain.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          <span className="text-xs uppercase tracking-wide">Stealth address</span>
        </div>
        <p className="font-mono text-sm text-foreground break-all leading-relaxed">
          {walletAddress}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy {short}
            </>
          )}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4 space-y-2">
        <p className="text-xs font-medium text-foreground">How this address works</p>
        <ul className="space-y-1.5">
          {[
            "Senders use this address to look up your mailbox policy.",
            "Postage payments are routed to your Stellar account.",
            "Delivery proofs are anchored on the Stellar ledger.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetreat}
          className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.99]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
