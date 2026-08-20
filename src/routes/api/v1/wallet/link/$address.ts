import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { parseSessionCookie, validateSession } from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { unlinkExternalWallet } from "@/server/api/wallet-link-service";

export const MAX_RECENT_AUTH_AGE_MS = 15 * 60 * 1000; // 15 minutes

export const Route = createFileRoute("/api/v1/wallet/link/$address")({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const owner = requireActor(request);
          const address = stellarAddressSchema.parse(params.address);

          const sessionId = parseSessionCookie(request.headers.get("cookie"));
          if (sessionId) {
            const activeSession = await validateSession(apiContext, sessionId);
            if (!activeSession) {
              throw new ApiError(401, "unauthorized", "Session is invalid or expired");
            }
            const lastActive = new Date(activeSession.session.lastActiveAt).getTime();
            if (Date.now() - lastActive > MAX_RECENT_AUTH_AGE_MS) {
              throw new ApiError(
                401,
                "unauthorized",
                "Stale session: recent authentication required",
              );
            }
          }

          const url = new URL(request.url);
          const confirmQuery = url.searchParams.get("confirm");
          const confirmHeader = request.headers.get("x-stealth-confirm");
          const isExplicitlyDenied = confirmQuery === "false" || confirmHeader === "false";

          if (isExplicitlyDenied) {
            throw new ApiError(
              400,
              "bad_request",
              "Explicit confirmation is required to unlink wallet",
            );
          }

          const repo = apiContext.repository;
          const requestId = apiContext.requestId || "unknown";
          const activeSigner = await unlinkExternalWallet(repo, owner, address, requestId);

          return apiSuccess(request, { unlinked: true, activeSigner });
        }),
    },
  },
});
