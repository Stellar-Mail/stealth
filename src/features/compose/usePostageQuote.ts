import { useEffect, useRef, useState } from "react";

/**
 * The shape returned by the server's `quotePostage` function.
 * Mirrors `{ amount, eligible, reason, trusted }`.
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
    | "unknown_senders_disabled"
    | "verification_required"
    | "insufficient_postage";
  /** True when the sender has an explicit `allow` rule on the recipient's mailbox. */
  trusted: boolean;
};

export type PostageQuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "quoted"; quote: PostageQuote }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 400;

/**
 * Fetches a postage quote from the policy API whenever `recipient` or `sender`
 * changes. Uses a 400 ms debounce and cancels stale requests via AbortController.
 *
 * On API failure the hook returns `{ status: "error" }` — callers should show a
 * non-blocking warning rather than preventing send entirely.
 *
 * @param recipient Recipient address (any format accepted by the compose form)
 * @param sender    Sender's Stellar G-address
 */
export function usePostageQuote(recipient: string, sender: string): PostageQuoteState {
  const [quoteState, setQuoteState] = useState<PostageQuoteState>({ status: "idle" });
  // Track the most-recent AbortController so we can cancel inflight requests
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmedRecipient = recipient.trim();
    const trimmedSender = sender.trim();

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
        const params = new URLSearchParams({ recipient: trimmedRecipient, sender: trimmedSender });
        const response = await fetch(`/api/postage/quote?${params.toString()}`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!response.ok) {
          const text = await response.text().catch(() => "Unknown error");
          setQuoteState({ status: "error", message: text || `HTTP ${response.status}` });
          return;
        }

        const quote = (await response.json()) as PostageQuote;
        setQuoteState({ status: "quoted", quote });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Request was intentionally aborted — don't update state
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to fetch postage quote";
        setQuoteState({ status: "error", message });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [recipient, sender]);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return quoteState;
}
