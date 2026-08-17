import { createFileRoute } from "@tanstack/react-router";

import { logoutSession, parseSessionCookie } from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/auth/logout")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const sessionId = parseSessionCookie(request.headers.get("cookie"));
          const host = request.headers.get("host") ?? undefined;

          const result = await logoutSession(apiContext, sessionId, { host });

          const response = apiSuccess(request, { success: true });
          for (const header of result.cookieHeaders) {
            response.headers.append("Set-Cookie", header);
          }
          return response;
        }),
    },
  },
});
