import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext, getObjectStore } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { ApiError } from "@/server/api/errors";
import {
  uploadChunk,
  getUploadSession,
  type UploadSessionError,
} from "@/services/attachment/upload-session";
import {
  attachmentChunkKey,
  createObjectCommitment,
  OBJECT_KIND_ATTACHMENT_CHUNK,
} from "@/services/storage/object-store";

const uploadChunkSchema = z.object({
  session_id: z.string().trim().min(1).max(128),
  attachment_index: z.number().int().nonnegative(),
  chunk_index: z.number().int().nonnegative(),
  nonce: z.string().min(1, "nonce is required"),
  ciphertext: z.string().min(1, "ciphertext is required"),
  mac: z.string().min(1, "mac is required"),
  final: z.boolean(),
});

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export const Route = createFileRoute("/api/v1/attachments/chunk")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const ctx = await getApiContext(request);
          if (!ctx.isAuthenticated) {
            throw new ApiError(401, "unauthorized", "Authentication is required");
          }

          const input = await parseJsonBody(request, uploadChunkSchema, "relay");
          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";

          const nonceBytes = hexToBytes(input.nonce);
          const ciphertextBytes = Uint8Array.from(atob(input.ciphertext), (c) => c.charCodeAt(0));
          const macBytes = hexToBytes(input.mac);

          const chunkBytes = new Uint8Array(
            nonceBytes.length + ciphertextBytes.length + macBytes.length,
          );
          chunkBytes.set(nonceBytes, 0);
          chunkBytes.set(ciphertextBytes, nonceBytes.length);
          chunkBytes.set(macBytes, nonceBytes.length + ciphertextBytes.length);

          const { enforceCentralAbuse } = await import("@/server/api/abuse-service");
          const decision = await enforceCentralAbuse(ctx.repository, {
            route: "attachment_upload",
            ip,
            account: ctx.principal.address,
            session: input.session_id,
            storageBytes: chunkBytes.length,
            headers: request.headers,
          });

          if (!decision.allowed) {
            throw new ApiError(
              429,
              "too_many_requests",
              decision.reason === "storage_byte_budget_exceeded"
                ? "Attachment chunk storage byte budget exceeded"
                : "Attachment rate limit exceeded",
              { retryAfterSeconds: decision.retryAfterSeconds ?? 3600 },
            );
          }

          try {
            const result = await uploadChunk({
              sessionId: input.session_id,
              ownerAddress: ctx.principal.address,
              attachmentIndex: input.attachment_index,
              chunkIndex: input.chunk_index,
              chunkBytes: ciphertextBytes,
            });

            const session = getUploadSession(input.session_id);
            if (session) {
              const attachment = session.attachments[input.attachment_index];
              if (attachment) {
                const objectStore = await getObjectStore();
                if (objectStore) {
                  const contentCommitment = await createObjectCommitment(chunkBytes);
                  const key = attachmentChunkKey(
                    session.messageId,
                    contentCommitment,
                    input.chunk_index,
                  );

                  try {
                    const { stagedKey } = await objectStore.stage({
                      kind: OBJECT_KIND_ATTACHMENT_CHUNK,
                      messageId: session.messageId,
                      ownerAddress: ctx.principal.address,
                      contentType: "application/octet-stream",
                      contentLength: chunkBytes.length,
                      contentCommitment,
                      bytes: chunkBytes,
                      chunkIndex: input.chunk_index,
                      totalChunks: attachment.totalChunks,
                    });

                    await objectStore.finalize({
                      stagedKey,
                      ownerAddress: ctx.principal.address,
                      expectedContentLength: chunkBytes.length,
                      expectedCommitment: contentCommitment,
                    });
                  } catch {
                    // Object store may not be available in dev/test; session tracking still works
                  }
                }
              }
            }

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
