import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema, stellarAddressSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const initiateSchema = z.object({
  attachmentId: z.string().optional(),
  messageId: hash32Schema,
  sender: stellarAddressSchema,
  recipient: stellarAddressSchema,
  filename: z.string().min(1),
  contentType: z.string(),
  size: z.number().int().positive(),
  chunkCount: z.number().int().positive(),
  chunkSize: z.number().int().positive().optional(),
  commitment: z.string().min(1),
});

export const Route = createFileRoute("/api/v1/attachments/initiate")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const input = await parseJsonBody(request, initiateSchema);
          requireActorMatches(request, input.sender);

          const storage = getApiContext().repository.getAttachmentStorage();
          const session = await storage.initiateSession(input);

          return apiSuccess(request, session, { status: 201 });
        }),
    },
  },
});
