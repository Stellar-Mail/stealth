import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema, hash32Schema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { initiateUploadSession } from "@/services/attachment/upload-session";

const initiateAttachmentSchema = z.object({
  message_id: hash32Schema,
  attachments: z
    .array(
      z.object({
        filename: z.string().trim().min(1).max(256),
        content_type: z.string().trim().min(1).max(128),
        size_bytes: z
          .number()
          .int()
          .nonnegative()
          .max(16 * 1024 * 1024),
        content_hash: hash32Schema,
        total_chunks: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(16),
});

export const Route = createFileRoute("/api/v1/attachments/initiate")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const ctx = await getApiContext(request);
          if (!ctx.isAuthenticated) {
            throw new (await import("@/server/api/errors")).ApiError(
              401,
              "unauthorized",
              "Authentication is required",
            );
          }

          const input = await parseJsonBody(request, initiateAttachmentSchema, "compact");
          const result = initiateUploadSession({
            ownerAddress: ctx.principal.address,
            messageId: input.message_id,
            attachments: input.attachments,
          });

          return apiSuccess(request, result);
        }),
    },
  },
});
