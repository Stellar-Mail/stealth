import { Buffer } from "node:buffer";
import { Keypair } from "@stellar/stellar-sdk";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { loadRuntimeConfig } from "@/config";
import { canonicalizePayload } from "@/services/crypto/envelope";
import { envelopePayloadSchema } from "@/services/crypto/schema";
import { decryptWalletSecret } from "@/services/stellar/wallet-secret-crypto";
import { requireActor } from "@/server/api/actor";
import { parseSessionCookie, validateSession } from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const authorizationSchema = z.object({ canonical: z.string().min(1) }).strict();
const envelopeSchema = envelopePayloadSchema.and(
  z
    .object({
      version: z.literal("v1"),
      request_nonce: z.string().regex(/^[a-f0-9]{32}$/),
      audience: z.string().min(1),
      idempotency_key: z.string().min(1),
      replay_window_seconds: z.number().int().positive(),
    })
    .passthrough(),
);

async function requireAccountWallet(request: Request) {
  const context = await getApiContext();
  const sessionId = parseSessionCookie(request.headers.get("cookie"));
  const session = sessionId ? await validateSession(context, sessionId) : null;
  if (!session) throw new ApiError(401, "unauthorized", "Sign in to stamp your mail");

  const actor = requireActor({
    ...context,
    isAuthenticated: true,
    principal: {
      address: session.user.address,
      authMethod: "session",
      authenticatedAt: new Date(),
      metadata: { userId: session.user.userId },
    },
  });
  const user = await context.repository.getUserByAddress(actor);
  if (!user) throw new ApiError(404, "not_found", "Sending account not found");
  const wallet = await context.repository.getManagedWallet(user.userId);
  if (!wallet) throw new ApiError(409, "conflict", "Your account stamp is not ready yet");
  if (wallet.address !== actor) {
    throw new ApiError(409, "conflict", "Account stamp does not match the sending account");
  }
  return wallet;
}

export const Route = createFileRoute("/api/v1/envelopes/authorize")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const wallet = await requireAccountWallet(request);
          return apiSuccess(request, { signerAddress: wallet.address });
        }),
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const wallet = await requireAccountWallet(request);
          const { canonical } = await parseJsonBody(request, authorizationSchema, "relay");
          let payload: z.infer<typeof envelopeSchema>;
          try {
            payload = envelopeSchema.parse(JSON.parse(canonical));
          } catch {
            throw new ApiError(400, "bad_request", "Expected a canonical mail envelope");
          }
          // Limit this key to mail envelopes owned by the authenticated sender.
          if (payload.sender !== wallet.address) {
            throw new ApiError(403, "forbidden", "Envelope sender does not match your account");
          }
          if (canonicalizePayload(payload) !== canonical) {
            throw new ApiError(400, "bad_request", "Envelope payload is not canonical");
          }
          const config = loadRuntimeConfig();
          const seed = await decryptWalletSecret(
            wallet.encryptedSecret,
            config.secrets?.storageSecret ?? "dev-storage-secret-change-me",
          );
          const keypair = Keypair.fromSecret(seed);
          if (keypair.publicKey() !== wallet.address) {
            throw new ApiError(409, "conflict", "Account stamp integrity check failed");
          }
          return apiSuccess(request, {
            scheme: "Ed25519",
            signerAddress: wallet.address,
            value: keypair.sign(Buffer.from(canonical, "utf8")).toString("hex"),
          });
        }),
    },
  },
});
