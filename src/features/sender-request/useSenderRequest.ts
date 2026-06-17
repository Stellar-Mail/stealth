import { useCallback, useState } from "react";
import {
  INITIAL_STATE,
  stroopsToXlm,
  type AddressResolution,
  type DeliveryOutcome,
  type PostageSubmission,
  type SenderIdentity,
  type SenderRequestState,
  type SenderRequestStep,
} from "./types";

const STEP_ORDER: SenderRequestStep[] = [
  "address-lookup",
  "policy-quote",
  "identity-proof",
  "postage-payment",
  "delivery-status",
  "refund-outcome",
];

function nextStep(step: SenderRequestStep): SenderRequestStep {
  const i = STEP_ORDER.indexOf(step);
  return i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : step;
}

function prevStep(step: SenderRequestStep): SenderRequestStep {
  const i = STEP_ORDER.indexOf(step);
  return i > 0 ? STEP_ORDER[i - 1] : step;
}

export function useSenderRequest() {
  const [state, setState] = useState<SenderRequestState>(INITIAL_STATE);

  const patch = useCallback((partial: Partial<SenderRequestState>) => {
    setState((s) => ({ ...s, ...partial }));
  }, []);

  const advance = useCallback(() => {
    setState((s) => ({
      ...s,
      step: nextStep(s.step),
      direction: 1,
      error: null,
    }));
  }, []);

  const retreat = useCallback(() => {
    setState((s) => ({
      ...s,
      step: prevStep(s.step),
      direction: -1,
      error: null,
    }));
  }, []);

  /** Step 1 → 2: resolve address and fetch quote. */
  const resolveAddress = useCallback(
    async (displayHandle: string) => {
      patch({ loading: true, error: null });
      try {
        // Resolve address: if it's already a G-address use directly, otherwise
        // treat as a display handle. Production would call a federation endpoint.
        const recipientAddress = /^G[A-Z2-7]{55}$/.test(displayHandle.trim())
          ? displayHandle.trim()
          : `G${"A".repeat(55)}`; // placeholder for federation resolution

        const res = await fetch("/api/v1/postage/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: recipientAddress,
            // Use a dummy sender for the quote — no identity required yet
            sender: `G${"B".repeat(55)}`,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message ?? "Could not fetch quote");
        }

        const data = (await res.json()) as {
          amount: string;
          eligible: boolean;
          reason: "trusted_sender" | "mailbox_minimum" | "sender_blocked";
          trusted: boolean;
        };

        setState((s) => ({
          ...s,
          loading: false,
          resolution: { recipientAddress, displayHandle },
          quote: { ...data, amountXlm: stroopsToXlm(data.amount) },
          step: nextStep(s.step),
          direction: 1,
          error: null,
        }));
      } catch (err) {
        patch({ loading: false, error: (err as Error).message });
      }
    },
    [patch],
  );

  /** Step 3: connect wallet (Freighter) or accept manually entered address. */
  const connectIdentity = useCallback(
    async (identity: SenderIdentity) => {
      patch({ loading: true, error: null });
      try {
        // Re-fetch quote with the real sender address so price is accurate.
        if (state.resolution) {
          const res = await fetch("/api/v1/postage/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: state.resolution.recipientAddress,
              sender: identity.address,
            }),
          });

          if (res.ok) {
            const data = (await res.json()) as {
              amount: string;
              eligible: boolean;
              reason: "trusted_sender" | "mailbox_minimum" | "sender_blocked";
              trusted: boolean;
            };

            setState((s) => ({
              ...s,
              loading: false,
              identity,
              quote: { ...data, amountXlm: stroopsToXlm(data.amount) },
              step: nextStep(s.step),
              direction: 1,
              error: null,
            }));
            return;
          }
        }

        setState((s) => ({
          ...s,
          loading: false,
          identity,
          step: nextStep(s.step),
          direction: 1,
          error: null,
        }));
      } catch (err) {
        patch({ loading: false, error: (err as Error).message });
      }
    },
    [state.resolution, patch],
  );

  /** Step 4: submit postage payment proof. */
  const submitPayment = useCallback(
    async (submission: PostageSubmission) => {
      patch({ loading: true, error: null });
      try {
        if (!state.resolution || !state.identity || !state.quote) {
          throw new Error("Incomplete flow state — cannot submit postage");
        }

        const res = await fetch("/api/v1/postage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: submission.messageId,
            paymentHash: submission.paymentHash,
            amount: submission.amount,
            recipient: state.resolution.recipientAddress,
            sender: state.identity.address,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message ?? "Payment submission failed");
        }

        setState((s) => ({
          ...s,
          loading: false,
          submission,
          step: nextStep(s.step),
          direction: 1,
          error: null,
        }));
      } catch (err) {
        patch({ loading: false, error: (err as Error).message });
      }
    },
    [state.resolution, state.identity, state.quote, patch],
  );

  /** Step 5: poll/set delivery outcome. */
  const resolveDelivery = useCallback(
    async (outcome: DeliveryOutcome) => {
      setState((s) => ({
        ...s,
        outcome,
        step: outcome.state !== "pending" ? nextStep(s.step) : s.step,
        direction: 1,
      }));
    },
    [],
  );

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return {
    state,
    advance,
    retreat,
    resolveAddress,
    connectIdentity,
    submitPayment,
    resolveDelivery,
    reset,
  };
}
