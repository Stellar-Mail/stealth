import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { AttachmentStorageError } from "@/services/storage/attachment-storage";

function parseRangeHeader(header: string | null): { start?: number; end?: number } | undefined {
  if (!header || !header.startsWith("bytes=")) return undefined;

  const parts = header.replace("bytes=", "").split("-");
  const start = parts[0] ? Number.parseInt(parts[0], 10) : undefined;
  const end = parts[1] ? Number.parseInt(parts[1], 10) : undefined;

  return {
    ...(start !== undefined && !Number.isNaN(start) ? { start } : {}),
    ...(end !== undefined && !Number.isNaN(end) ? { end } : {}),
  };
}

export const Route = createFileRoute("/api/v1/attachments/$attachmentId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const actor = requireActor(request);
          const { attachmentId } = params;

          const rangeHeader = request.headers.get("range");
          const range = parseRangeHeader(rangeHeader);

          const storage = getApiContext().repository.getAttachmentStorage();
          const content = await storage.getAttachmentContent(attachmentId, actor, range);

          const status = content.contentRange ? 206 : 200;
          const headers = new Headers();
          headers.set("content-type", content.contentType);
          headers.set(
            "content-disposition",
            `attachment; filename="${encodeURIComponent(content.filename)}"`,
          );
          headers.set("x-attachment-commitment", content.commitment);
          headers.set("accept-ranges", "bytes");
          headers.set("cache-control", "private, no-cache, no-store, must-revalidate");

          if (content.contentRange) {
            headers.set("content-range", content.contentRange);
            headers.set("content-length", content.data.length.toString());
          } else {
            headers.set("content-length", content.totalSize.toString());
          }

          return new Response(content.data, {
            status,
            headers,
          });
        }),

      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const actor = requireActor(request);
          const { attachmentId } = params;

          const storage = getApiContext().repository.getAttachmentStorage();
          await storage.abortSession(attachmentId, actor);

          return apiSuccess(request, { aborted: true, attachmentId });
        }),
    },
  },
});
