/**
 * Relay HTTP transport (Issue #1935 BETA-028).
 *
 * Shared, transport-agnostic handlers backing both the Cloudflare worker routes
 * (`/api/v1/relay/*`) and the local Docker entry (`/health`, `/readiness`,
 * `/version`, `/messages`). Each handler takes the resolved {@link RelayService}
 * so callers control service construction.
 *
 * Auth is deliberately self-contained (actor header validated against the
 * submitted sender) and does not pull in the API context module, which resolves
 * the Cloudflare bindings and would break the Docker bundle.
 */
import { ApiError } from "@/server/api/errors";
import { stellarAddressSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

import { publicAdmissionDecision } from "./admission";
import { relaySubmissionSchema, RELAY_SERVICE_NAME, type RelayService } from "./relay-service";

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

export function handleRelayHealth(request: Request, service: RelayService) {
  return handleApiRequest(request, async () => {
    const health = await service.checkHealth();
    return apiSuccess(request, health, { status: 200 });
  });
}

export function handleRelayReadiness(request: Request, service: RelayService) {
  return handleApiRequest(request, async () => {
    const readiness = await service.checkReadiness();
    return apiSuccess(request, readiness, { status: readiness.ready ? 200 : 503 });
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
    const input = await parseJsonBody(request, relaySubmissionSchema, {
      route: "POST /relay/messages",
    });
    requireRelayActor(request, input.sender);

    const readiness = await service.checkReadiness();
    if (!readiness.ready) {
      throw new ApiError(503, "dependency_unavailable", "Relay is not ready to accept messages");
    }

    const result = await service.submit(input);
    return apiSuccess(
      request,
      {
        accepted: result.accepted,
        messageId: result.messageId,
        queueDepth: result.queueDepth,
        service: RELAY_SERVICE_NAME,
        replayed: result.replayed,
        admission: {
          ...result.admission,
          ...publicAdmissionDecision(result.admission),
        },
      },
      { status: 202 },
    );
  });
}
