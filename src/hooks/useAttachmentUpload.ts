import { useCallback, useRef, useState } from "react";

import {
  computeAttachmentCommitment,
  computeChunkHash,
  sanitizeContentType,
  sanitizeFilename,
} from "@/services/crypto/attachment-stream";

export interface AttachmentUploadOptions {
  messageId: string;
  sender: string;
  recipient: string;
  chunkSize?: number;
  maxRetries?: number;
}

export interface AttachmentUploadState {
  attachmentId?: string;
  filename: string;
  size: number;
  progress: number; // 0 to 100
  status: "idle" | "initiating" | "uploading" | "paused" | "finalized" | "error" | "cancelled";
  commitment?: string;
  error?: string;
}

const DEFAULT_CHUNK_SIZE = 512 * 1024; // 512KB chunks

export function useAttachmentUpload() {
  const [uploads, setUploads] = useState<Record<string, AttachmentUploadState>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const uploadFile = useCallback(async (file: File, options: AttachmentUploadOptions) => {
    const fileId = `${file.name}_${file.size}_${Date.now()}`;
    const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    const maxRetries = options.maxRetries ?? 3;

    const sanitizedName = sanitizeFilename(file.name);
    const sanitizedType = sanitizeContentType(file.type, sanitizedName);

    const controller = new AbortController();
    abortControllersRef.current[fileId] = controller;

    setUploads((prev) => ({
      ...prev,
      [fileId]: {
        filename: sanitizedName,
        size: file.size,
        progress: 0,
        status: "initiating",
      },
    }));

    try {
      // 1. Read file into chunks & compute hashes
      const arrayBuffer = await file.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuffer);
      const chunkCount = Math.ceil(file.size / chunkSize) || 1;

      const chunks: Uint8Array[] = [];
      const chunkHashes: string[] = [];

      for (let i = 0; i < chunkCount; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunkData = fileBytes.subarray(start, end);
        chunks.push(chunkData);

        const hash = await computeChunkHash(chunkData);
        chunkHashes.push(hash);
      }

      const commitment = await computeAttachmentCommitment(chunkHashes, {
        filename: sanitizedName,
        contentType: sanitizedType,
        size: file.size,
      });

      // 2. Initiate Upload Session via API
      const initiateRes = await fetch("/api/v1/attachments/initiate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-stealth-address": options.sender,
        },
        body: JSON.stringify({
          messageId: options.messageId,
          sender: options.sender,
          recipient: options.recipient,
          filename: sanitizedName,
          contentType: sanitizedType,
          size: file.size,
          chunkCount,
          chunkSize,
          commitment,
        }),
        signal: controller.signal,
      });

      if (!initiateRes.ok) {
        throw new Error(`Initiate failed with status ${initiateRes.status}`);
      }

      const initiateResult = await initiateRes.json();
      const descriptor = initiateResult.data;
      const attachmentId = descriptor.attachmentId;

      // Check already uploaded chunks for upload resumption
      const alreadyUploaded = new Set<number>(descriptor.uploadedChunks || []);

      setUploads((prev) => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          attachmentId,
          status: "uploading",
          commitment,
        },
      }));

      // 3. Chunk Upload Loop with Retries
      let uploadedCount = alreadyUploaded.size;

      for (let i = 0; i < chunkCount; i++) {
        if (controller.signal.aborted) {
          throw new Error("Upload cancelled");
        }

        if (alreadyUploaded.has(i)) {
          continue;
        }

        const chunkData = chunks[i];
        const chunkHash = chunkHashes[i];

        let attempt = 0;
        let success = false;

        while (attempt < maxRetries && !success) {
          if (controller.signal.aborted) {
            throw new Error("Upload cancelled");
          }

          try {
            const chunkRes = await fetch(`/api/v1/attachments/${attachmentId}/chunks/${i}`, {
              method: "PUT",
              headers: {
                "content-type": "application/json",
                "x-stealth-address": options.sender,
                "x-chunk-hash": chunkHash,
              },
              body: JSON.stringify({
                data: btoa(
                  Array.from(chunkData)
                    .map((b) => String.fromCharCode(b))
                    .join(""),
                ),
                hash: chunkHash,
              }),
              signal: controller.signal,
            });

            if (chunkRes.ok) {
              success = true;
              uploadedCount++;
              const progress = Math.round((uploadedCount / chunkCount) * 100);
              setUploads((prev) => ({
                ...prev,
                [fileId]: {
                  ...prev[fileId],
                  progress,
                },
              }));
            } else {
              attempt++;
              if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
              }
            }
          } catch (err: unknown) {
            const isAbort = err instanceof Error && err.name === "AbortError";
            if (isAbort) throw err;
            attempt++;
            if (attempt < maxRetries) {
              await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
            }
          }
        }

        if (!success) {
          throw new Error(`Failed to upload chunk ${i} after ${maxRetries} attempts`);
        }
      }

      // 4. Finalize Session
      const finalizeRes = await fetch(`/api/v1/attachments/${attachmentId}/finalize`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-stealth-address": options.sender,
        },
        body: JSON.stringify({ commitment }),
        signal: controller.signal,
      });

      if (!finalizeRes.ok) {
        throw new Error(`Finalize failed with status ${finalizeRes.status}`);
      }

      const finalizeResult = await finalizeRes.json();

      setUploads((prev) => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          status: "finalized",
          progress: 100,
        },
      }));

      delete abortControllersRef.current[fileId];
      return finalizeResult.data;
    } catch (error: unknown) {
      delete abortControllersRef.current[fileId];

      const isAbort =
        error instanceof Error &&
        (error.name === "AbortError" || error.message === "Upload cancelled");
      if (isAbort) {
        setUploads((prev) => ({
          ...prev,
          [fileId]: {
            ...prev[fileId],
            status: "cancelled",
          },
        }));
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      setUploads((prev) => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          status: "error",
          error: errorMessage,
        },
      }));
      throw error;
    }
  }, []);

  const cancelUpload = useCallback(
    async (fileId: string, senderAddress?: string) => {
      const controller = abortControllersRef.current[fileId];
      if (controller) {
        controller.abort();
        delete abortControllersRef.current[fileId];
      }

      const state = uploads[fileId];
      if (state?.attachmentId && senderAddress) {
        try {
          await fetch(`/api/v1/attachments/${state.attachmentId}`, {
            method: "DELETE",
            headers: {
              "x-stealth-address": senderAddress,
            },
          });
        } catch {
          // Ignore background cleanup error
        }
      }

      setUploads((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
    },
    [uploads],
  );

  return {
    uploads,
    uploadFile,
    cancelUpload,
  };
}
