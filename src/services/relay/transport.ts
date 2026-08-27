import { createPublicKey, verify } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";

import { ApiError } from "@/server/api/errors";
import { stellarAddressSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  canonicalizeSignedRequest,
  signedRequestTimeStatus,
  validateSignedRequestAudience,
} from "@/server/api/auth/signed-request";
import {
  verifyRelayRequest,
  RelayAuthError,
  type RelayAuthConfig,
  type RelayRequest,
} from "@/services/crypto/relayAuth";

import { enforceCentralAbuse } from "@/server/api/abuse-service";
import {
  relaySubmissionSchema,
  RELAY_MAX_PAYLOAD_BYTES,
  RELAY_SERVICE_NAME,
  type RelayService,
} from "./relay-service";

function requireRelayActor(request: Request, expectedAddress: string): string {
  const raw = request.headers.get("x-stealth-address");
  if (!raw) {
    throw new ApiError(401, "unauthorized", "Missing x-stealth-address header");
  }
  const parsed = stellarAddressSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(401, "unauthorized", "x-stealth-address must be a valid Stellar G-address");
  }
  if (parsed.data !== expectedAddress) {
    throw new ApiError(403, "forbidden", "Sender does not match the authenticated actor");
  }
  return parsed.data;
}

function defaultVerify({
  publicKey,
  message,
  signature,
}: {
  publicKey: string;
  message: string;
  signature: string;
}): boolean {
  try {
    const isBase64 = signature.length === 88 && !/^[0-9a-fA-F]+$/.test(signature);
    const sigBuf = Buffer.from(signature, isBase64 ? "base64" : "hex");
    const msgBuf = Buffer.from(message);
    if (publicKey.startsWith("G") && publicKey.length === 56) {
      const kp = Keypair.fromPublicKey(publicKey);
      if (kp.verify(msgBuf, sigBuf)) return true;
      const domainMsg = Buffer.from("stealth-mail-envelope-v1:" + message);
      return kp.verify(domainMsg, sigBuf);
    }
    const key = createPublicKey({
      key: Buffer.from(publicKey, "hex"),
      format: "der",
      type: "spki",
    });
    return verify(null, msgBuf, key, sigBuf);
  } catch {
    return false;
  }
}

function mapRelayAuthErrorToApiError(err: RelayAuthError): ApiError {
  let apiCode: "unauthorized" | "forbidden" | "conflict" | "bad_request";
  switch (err.code) {
    case "INVALID_SIGNATURE":
      apiCode = "unauthorized";
      break;
    case "AUDIENCE_MISMATCH":
      apiCode = "forbidden";
      break;
    case "REPLAY_DETECTED":
      apiCode = "conflict";
      break;
    default:
      apiCode = "bad_request";
      break;
  }
  return new ApiError(err.httpStatus, apiCode, `${err.code}: ${err.message}`, {
    relayErrorCode: err.code,
  });
}

export function handleRelayHealth(request: Request, service: RelayService) {
  return handleApiRequest(request, async () => {
    const health = await service.checkHealth();
    return apiSuccess(request, health, { status: 200 });
  });
}

export function handleRelayReadiness(request: Request, service: RelayService) {
  return handleApiRequest(request, async () => {
    const readiness = await service.checkReadiness();
    return apiSuccess(request, readiness, {
      status: readiness.ready ? 200 : 503,
    });
  });
}

export function handleRelayVersion(request: Request, service: RelayService) {
  return handleApiRequest(request, async () => {
    const version = service.getVersion();
    return apiSuccess(request, version, { status: 200 });
  });
}

export function handleRelaySubmit(request: Request, service: RelayService) {
  return handleApiRequest(request, async () => {
    const rawBodyText = await request.text();
    if (!rawBodyText || !rawBodyText.trim()) {
      throw new ApiError(400, "bad_request", "Request body must not be empty");
    }
    if (Buffer.byteLength(rawBodyText, "utf8") > RELAY_MAX_PAYLOAD_BYTES) {
      throw new ApiError(
        413,
        "bad_request",
        `Request body exceeds ${RELAY_MAX_PAYLOAD_BYTES} bytes`,
      );
    }

    let jsonBody: unknown;
    try {
      jsonBody = JSON.parse(rawBodyText);
    } catch {
      throw new ApiError(400, "bad_request", "Invalid JSON payload");
    }

    const parsedInput = relaySubmissionSchema.safeParse(jsonBody);
    if (!parsedInput.success) {
      throw new ApiError(422, "validation_error", "Request validation failed");
    }
    const input = parsedInput.data;

    // 1. Pre-auth Central Abuse Enforcement: check IP, storage bytes, and relay ID before expensive crypto
    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const payloadBytes = Buffer.byteLength(rawBodyText, "utf8");
    const relayId = request.headers.get("x-stealth-relay-id") ?? undefined;
    const repo = service.getRepository();

    if (repo && typeof repo.incrementCounter === "function") {
      const preAuthDecision = await enforceCentralAbuse(repo, {
        route: "relay_submit",
        ip,
        storageBytes: payloadBytes,
        relayId,
        headers: request.headers,
      });

      if (!preAuthDecision.allowed) {
        throw new ApiError(
          429,
          "too_many_requests",
          preAuthDecision.reason === "storage_byte_budget_exceeded"
            ? "Relay storage byte budget exceeded"
            : "Relay rate limit exceeded",
          {
            retryAfterSeconds: preAuthDecision.retryAfterSeconds ?? 3600,
          },
        );
      }
    }

    const nowSeconds = service.getConfig().nowSeconds
      ? service.getConfig().nowSeconds!()
      : Math.floor(Date.now() / 1000);
    const nowMs = nowSeconds * 1000;

    let relayReq: RelayRequest | null = null;
    try {
      if (typeof input.payload === "string" && input.payload.trim().startsWith("{")) {
        const parsed = JSON.parse(input.payload);
        if (parsed && typeof parsed === "object" && parsed.payload && parsed.signature) {
          relayReq = parsed as RelayRequest;
        }
      } else if (
        jsonBody &&
        typeof jsonBody === "object" &&
        "payload" in jsonBody &&
        "signature" in jsonBody
      ) {
        relayReq = jsonBody as unknown as RelayRequest;
      }
    } catch {
      // Not a RelayRequest container
    }

    let isReplayed = false;

    if (relayReq) {
      const authConfig: RelayAuthConfig = {
        audience: service.getAudience(),
        verify: defaultVerify,
        resolvePublicKey: (sender) => sender,
        isNonceSeen: (nonce) => service.isNonceSeen(nonce),
        markNonceSeen: (nonce) => service.markNonceSeen(nonce),
        getIdempotencyResult: (key) => service.getIdempotencyResult(key),
        storeIdempotencyResult: (key, res) => service.storeIdempotencyResult(key, res),
        nowSeconds: () => nowSeconds,
      };

      try {
        const verified = verifyRelayRequest(relayReq, authConfig);
        if (verified.idempotencyReplayed) {
          isReplayed = true;
        }
      } catch (err) {
        if (err instanceof RelayAuthError) {
          throw mapRelayAuthErrorToApiError(err);
        }
        throw err;
      }
    } else {
      const signatureHeader = request.headers.get("x-stealth-signature");
      const nonceHeader = request.headers.get("x-stealth-nonce");
      const timestampHeader = request.headers.get("x-stealth-timestamp");
      const audienceHeader = request.headers.get("x-stealth-audience");

      requireRelayActor(request, input.sender);

      if (signatureHeader || nonceHeader || timestampHeader || audienceHeader) {
        if (!audienceHeader) {
          throw new ApiError(400, "bad_request", "Missing x-stealth-audience header");
        }
        if (!timestampHeader) {
          throw new ApiError(400, "bad_request", "Missing x-stealth-timestamp header");
        }
        if (!nonceHeader || nonceHeader.length < 16) {
          throw new ApiError(400, "bad_request", "Missing or invalid x-stealth-nonce header");
        }

        try {
          validateSignedRequestAudience(audienceHeader, {
            activeAudiences: new Set([service.getAudience()]),
          });
        } catch {
          throw new ApiError(
            403,
            "forbidden",
            `audience ${audienceHeader} != ${service.getAudience()}`,
          );
        }

        const timeStatus = signedRequestTimeStatus(timestampHeader, nowMs);
        if (timeStatus === "expired") {
          throw new ApiError(
            400,
            "bad_request",
            "STALE_REQUEST: Timestamp older than allowed window",
          );
        }
        if (timeStatus === "future") {
          throw new ApiError(400, "bad_request", "FUTURE_REQUEST: Timestamp too far in the future");
        }
        if (timeStatus === "invalid") {
          throw new ApiError(
            400,
            "bad_request",
            "INVALID_REQUEST: Invalid x-stealth-timestamp header",
          );
        }

        const actorHeader = request.headers.get("x-stealth-address");
        if (!actorHeader) {
          throw new ApiError(401, "unauthorized", "Missing x-stealth-address header");
        }
        requireRelayActor(request, input.sender);

        if (signatureHeader) {
          const urlObj = new URL(request.url);
          const headersRecord: Record<string, string> = {
            host: urlObj.host,
          };
          request.headers.forEach((val, key) => {
            headersRecord[key.toLowerCase()] = val;
          });
          const canonicalMsg = canonicalizeSignedRequest({
            version: request.headers.get("x-stealth-version") ?? "STEALTH-AUTH-V1",
            method: request.method,
            url: request.url,
            headers: headersRecord,
            body: rawBodyText,
          });

          const sigOk = defaultVerify({
            publicKey: actorHeader,
            message: canonicalMsg,
            signature: signatureHeader,
          });
          if (!sigOk) {
            throw new ApiError(401, "unauthorized", "Signature verification failed");
          }
        }

        if (service.isNonceSeen(nonceHeader)) {
          throw new ApiError(409, "conflict", "REPLAY_DETECTED: request_nonce already recorded");
        }
        service.markNonceSeen(nonceHeader);
      }
    }

    // 2. Post-auth Central Abuse Enforcement: charge authenticated sender account and recipient quotas
    if (repo && typeof repo.incrementCounter === "function") {
      const postAuthDecision = await enforceCentralAbuse(repo, {
        route: "relay_submit",
        account: input.sender,
        recipient: input.recipient,
        headers: request.headers,
      });

      if (!postAuthDecision.allowed) {
        throw new ApiError(
          429,
          "too_many_requests",
          postAuthDecision.reason === "recipient_rate_limit_exceeded"
            ? "Relay recipient rate limit exceeded"
            : "Relay account rate limit exceeded",
          {
            retryAfterSeconds: postAuthDecision.retryAfterSeconds ?? 3600,
          },
        );
      }
    }

    const readiness = await service.checkReadiness();
    if (!readiness.ready) {
      throw new ApiError(503, "dependency_unavailable", "Relay is not ready to accept messages");
    }

    const result = await service.submit(input);
    const responseHeaders: Record<string, string> = {};
    if (isReplayed) {
      responseHeaders["x-idempotency-replayed"] = "true";
    }

    return apiSuccess(
      request,
      { ...result, service: RELAY_SERVICE_NAME },
      { status: 202, headers: responseHeaders },
    );
  });
}

export function handleRelayQueue(request: Request, service: RelayService, recipient: string) {
  return handleApiRequest(request, async () => {
    const actorHeader = request.headers.get("x-stealth-address");
    if (!actorHeader) {
      throw new ApiError(401, "unauthorized", "Missing x-stealth-address header");
    }
    const parsedActor = stellarAddressSchema.safeParse(actorHeader);
    if (!parsedActor.success) {
      throw new ApiError(
        401,
        "unauthorized",
        "x-stealth-address must be a valid Stellar G-address",
      );
    }
    if (parsedActor.data !== recipient) {
      throw new ApiError(403, "forbidden", "Recipient does not match the authenticated actor");
    }

    const items = await service.getRecipientQueue(recipient);
    return apiSuccess(request, { items }, { status: 200 });
  });
}
