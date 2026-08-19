import { useEffect, useRef, useState } from "react";

import { sharedTypedApi as api, errorLabel, normalizeApiClientError } from "@/lib/api";

/**
 * The shape returned by the server's `quotePostage` function.
 * Mirrors `{ amount, eligible, reason, trusted, ... }` plus the authenticated
 * quote bindings exposed for compose guidance (BETA-039 / Issue #1946).
 */
export type PostageQuote = {
  /** Minimum postage amount in stroops (stringified bigint). "0" when trusted. */
  amount: string;
  /** False when the sender is explicitly blocked by the recipient's policy. */
  eligible: boolean;
  /** Machine-readable reason code from the policy engine. */
  reason:
    | "trusted_sender"
    | "mailbox_minimum"
    | "sender_blocked"
    | "insufficient_balance"
    | "unknown_senders_disabled"
    | "verification_required"
    | "insufficient_postage";
  /** True when the sender has an explicit `allow` rule on the recipient's mailbox. */
  trusted: boolean;
  /** Message identity the quote is bound to (server-echoed). */
  messageId?: string;
  /** Configured testnet asset the quote is bound to. */
  asset?: string;
  /** Recipient policy version the quote is bound to. */
  policyVersion?: number;
  /** Network passphrase the quote is bound to. */
  network?: string;
  /** Estimated fee in stroops and its basis-point rate. */
  fee?: { bps: number; amount: string };
  /** Sender balance guidance (nulls when the server cannot observe a balance). */
  balance?: { available: string | null; sufficient: boolean | null };
  /** Seconds until the quote expires; compose uses it to hint re-quoting. */
  retryAfterSeconds?: number;
  /** When the quote was issued. */
  issuedAt?: string;
  /** When the quote expires. */
  expiresAt?: string;
  /** HMAC digest binding every quoted field. */
  digest?: string;
};

export type PostageQuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "quoted"; quote: PostageQuote }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 400;

/**
 * Fetches a postage quote through the typed postage client whenever
 * `recipient` or `sender` changes. Uses a 400 ms debounce and cancels stale
 * requests via AbortController.
 *
 * On API failure the hook returns `{ status: "error" }` — callers should show a
 * non-blocking warning rather than preventing send entirely.
 */
export function usePostageQuote(
  recipient: string,
  sender: string,
  messageId?: string,
): PostageQuoteState {
  const [quoteState, setQuoteState] = useState<PostageQuoteState>({ status: "idle" });
  // Track the most-recent AbortController so we can cancel inflight requests
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmedRecipient = recipient.trim();
    const trimmedSender = sender.trim();
    const trimmedMessageId = messageId?.trim();

    // Nothing to quote without both addresses
    if (!trimmedRecipient || !trimmedSender) {
      setQuoteState({ status: "idle" });
      return;
    }

    // Debounce: wait for the user to stop typing before fetching
    const timer = setTimeout(async () => {
      // Cancel any previous in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setQuoteState({ status: "loading" });

      try {
        const quote = await api.postage.quote(
          {
            recipient: trimmedRecipient,
            sender: trimmedSender,
            messageId: trimmedMessageId || undefined,
          },
          controller.signal,
        );

        if (controller.signal.aborted) return;

        setQuoteState({ status: "quoted", quote });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Request was intentionally aborted — don't update state
          return;
        }
        const message = errorLabel(normalizeApiClientError(err));
        setQuoteState({ status: "error", message });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [recipient, sender, messageId]);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return quoteState;
}
