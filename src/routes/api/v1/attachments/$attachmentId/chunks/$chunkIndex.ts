import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const chunkPayloadSchema = z.object({
  data: z.string().min(1), // Base64 encoded chunk binary or string
  hash: z.string().optional(),
});

export const Route = createFileRoute("/api/v1/attachments/$attachmentId/chunks/$chunkIndex")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const actor = requireActor(request);
          const attachmentId = params.attachmentId;
          const chunkIndex = Number.parseInt(params.chunkIndex, 10);

          let binaryData: Uint8Array;
          let chunkHash = request.headers.get("x-chunk-hash") || "";

          const contentType = request.headers.get("content-type") || "";

          if (contentType.includes("application/json")) {
            const body = await parseJsonBody(request, chunkPayloadSchema);
            if (body.hash) {
              chunkHash = body.hash;
            }
            // Decode base64 or text
            try {
              binaryData = Uint8Array.from(atob(body.data), (c) => c.charCodeAt(0));
            } catch {
              binaryData = new TextEncoder().encode(body.data);
            }
          } else {
            const buffer = await request.arrayBuffer();
            binaryData = new Uint8Array(buffer);
          }

          const storage = getApiContext().repository.getAttachmentStorage();
          const result = await storage.uploadChunk({
            attachmentId,
            chunkIndex,
            data: binaryData,
            chunkHash,
            actorId: actor,
          });

          return apiSuccess(request, result);
        }),
    },
  },
});
