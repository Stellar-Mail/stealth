/**
 * Recipient Envelope Inbound Processing Pipeline.
 *
 * Provides a single hardened path from raw relay bytes to trusted, verified,
 * client-visible message data. Enforces all cryptographic metadata validations
 * before decrypting payload body or attachment keys, and quarantines corrupted,
 * tampered, or invalid mail.
 */

import {
  openEnvelope,
  OpenEnvelopeError,
  type KeyProvider,
  type OpenedEnvelope,
  type OpenEnvelopeOptions,
  type VerifiedEnvelopeProvenance,
} from "@/services/crypto/open-envelope";
import { parseSafeContent, type SafeMailContent } from "./safe-rendering";
import { createQuarantineRecord, type QuarantinedMailRecord } from "./quarantine";

export interface ProcessInboundEnvelopeOptions {
  input: { payload: unknown; ciphertext: unknown; signature?: unknown };
  keys: KeyProvider;
  expectedRecipient?: string;
  expectedSender?: string;
  requireSenderSignature?: boolean;
  timestampPolicy?: OpenEnvelopeOptions["timestampPolicy"];
  skipBoundsCheck?: boolean;
}

export type ProcessInboundEnvelopeResult =
  | {
      status: "success";
      opened: OpenedEnvelope;
      safeContent: SafeMailContent;
      provenance: VerifiedEnvelopeProvenance;
    }
  | {
      status: "quarantined";
      quarantineRecord: QuarantinedMailRecord;
      error: OpenEnvelopeError | Error;
    };

/**
 * Hardened inbound processing pipeline for recipient mail envelopes.
 *
 * 1. Validates envelope schema, bounds, version, algorithm, timestamps, recipient binding,
 *    and sender signature.
 * 2. Decrypts payload body and attachments ONLY if protected metadata passes validation.
 * 3. Sanitizes body content into safe structured reader blocks without rendering attacker HTML.
 * 4. Quarantines failing envelopes without throwing uncaught errors or leaking secrets.
 */
export async function processInboundEnvelope(
  options: ProcessInboundEnvelopeOptions,
): Promise<ProcessInboundEnvelopeResult> {
  const payloadSender = (options.input?.payload as any)?.sender;
  const payloadRecipient = (options.input?.payload as any)?.recipient;

  try {
    const openOpts: OpenEnvelopeOptions = {
      expectedRecipient: options.expectedRecipient,
      expectedSender: options.expectedSender,
      signature: (options.input as any)?.signature,
      requireSenderSignature: options.requireSenderSignature,
      timestampPolicy: options.timestampPolicy,
      skipBoundsCheck: options.skipBoundsCheck,
    };

    const opened = await openEnvelope(options.input, options.keys, openOpts);

    // Sanitize and structure body content
    const safeContent = parseSafeContent(opened.body);

    return {
      status: "success",
      opened,
      safeContent,
      provenance: opened.provenance,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const quarantineRecord = createQuarantineRecord(
      err,
      options.expectedSender ?? payloadSender,
      options.expectedRecipient ?? payloadRecipient,
    );

    return {
      status: "quarantined",
      quarantineRecord,
      error: err,
    };
  }
}
