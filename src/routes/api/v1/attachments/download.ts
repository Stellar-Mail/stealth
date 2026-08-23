import { createFileRoute } from "@tanstack/react-router";

import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { ApiError } from "@/server/api/errors";
import { getObjectStore } from "@/server/api/context";
import { attachmentChunkKey } from "@/services/storage/object-store";
import { normalizeSearchParams } from "@/server/api/request";
import { z } from "zod";
import { hash32Schema } from "@/server/api/domain";

const downloadQuerySchema = z.object({
  message_id: hash32Schema,
  content_hash: hash32Schema,
  chunk_index: z.coerce.number().int().nonnegative(),
});

export const Route = createFileRoute("/api/v1/attachments/download")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const ctx = await getApiContext(request);
          if (!ctx.isAuthenticated) {
            throw new ApiError(401, "unauthorized", "Authentication is required");
          }

          const params = normalizeSearchParams(request);
          const parsed = downloadQuerySchema.parse(params);

          const objectStore = await getObjectStore();
          if (!objectStore) {
            throw new ApiError(503, "dependency_unavailable", "Object store is unavailable");
          }

          const contentCommitment = `v1:sha256:hex:${parsed.content_hash}`;
          const key = attachmentChunkKey(parsed.message_id, contentCommitment, parsed.chunk_index);

          const stored = await objectStore.get(key, {
            ownerAddress: ctx.principal.address,
          });

          if (!stored) {
            throw new ApiError(404, "not_found", "Attachment chunk not found");
          }

          return apiSuccess(request, {
            chunk_data: Array.from(stored.bytes),
            content_type: stored.metadata.contentType,
            content_length: stored.metadata.contentLength,
            chunk_index: parsed.chunk_index,
          });
        }),
    },
  },
});
