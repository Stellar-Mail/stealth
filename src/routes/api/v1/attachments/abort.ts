import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { ApiError } from "@/server/api/errors";
import { abortUploadSession, type UploadSessionError } from "@/services/attachment/upload-session";

const abortSchema = z.object({
  session_id: z.string().trim().min(1).max(128),
});

export const Route = createFileRoute("/api/v1/attachments/abort")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const ctx = await getApiContext(request);
          if (!ctx.isAuthenticated) {
            throw new ApiError(401, "unauthorized", "Authentication is required");
          }

          const input = await parseJsonBody(request, abortSchema, "minimal");

          try {
            const result = abortUploadSession({
              sessionId: input.session_id,
              ownerAddress: ctx.principal.address,
            });

            return apiSuccess(request, result);
          } catch (error) {
            if (error && typeof error === "object" && "code" in error && "status" in error) {
              const sessionError = error as UploadSessionError;
              throw new ApiError(
                sessionError.status,
                sessionError.code as any,
                sessionError.message,
              );
            }
            throw error;
          }
        }),
    },
  },
});
