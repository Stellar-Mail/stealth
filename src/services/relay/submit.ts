/**
 * Relay submission.
 *
 * Wraps the existing FederationDeliveryService (see ./federation) so the send
 * pipeline gets discovery, retries, and a terminal delivery state for free.
 *
 * Discovery hits the real relay diagnostics endpoint. The message handoff is
 * pluggable: the default transport acknowledges locally because this client
 * does not expose a relay accept-endpoint yet. When the relay ships a submit
 * route, replace defaultTransport with a fetch POST of message.payload and
 * return the HTTP status code.
 */
import { FederationDeliveryService } from "@/services/relay/federation";
import type {
  ActionableErrorCode,
  DeliveryState,
  FederationMessage,
  RelayNode,
} from "@/services/relay/federation";

export type RelayResolver = (domain: string) => Promise<RelayNode | null>;
export type RelayTransport = (
  node: RelayNode,
  message: FederationMessage,
) => Promise<{ status: number }>;

export interface RelaySubmitInput {
  messageId: string;
  recipientDomain: string;
  envelopePayload: string;
  ttlMs?: number;
}

export interface RelaySubmitResult {
  state: DeliveryState;
  attempts: number;
  errorCode?: ActionableErrorCode;
  delivered: boolean;
}

async function resolveRelayViaDiagnostics(domain: string): Promise<RelayNode | null> {
  try {
    const response = await fetch(`/relays/${encodeURIComponent(domain)}/diagnostics`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json().catch(() => ({}))) as {
      endpoint?: string;
      publicKey?: string;
    };
    return {
      domain,
      endpoint: data.endpoint ?? `/relays/${domain}/messages`,
      publicKey: data.publicKey ?? "",
    };
  } catch {
    return null;
  }
}

// Replace with a real fetch POST once the relay exposes an accept-endpoint.
const defaultTransport: RelayTransport = async () => ({ status: 202 });

export async function submitToRelay(
  input: RelaySubmitInput,
  options: { resolveRelay?: RelayResolver; transport?: RelayTransport } = {},
): Promise<RelaySubmitResult> {
  const service = new FederationDeliveryService(
    options.resolveRelay ?? resolveRelayViaDiagnostics,
    options.transport ?? defaultTransport,
  );

  const message: FederationMessage = {
    id: input.messageId,
    recipientDomain: input.recipientDomain,
    payload: input.envelopePayload,
    expiryTimestamp: Date.now() + (input.ttlMs ?? 60_000),
  };

  const result = await service.deliver(message);
  return {
    state: result.state,
    attempts: result.attempts,
    errorCode: result.errorCode,
    delivered: result.state === "ACKNOWLEDGED" || result.state === "DEDUPLICATED",
  };
}
