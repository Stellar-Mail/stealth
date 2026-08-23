/**
 * React hook for authenticated attachment download (BETA-031 / #1938).
 *
 * Wraps the download service with React state management for progress,
 * status, and cancellation.
 */

import { useState, useCallback, useRef } from "react";
import {
  downloadAttachment,
  type DownloadAttachmentInput,
  type DownloadAttachmentResult,
} from "@/services/attachment/download";
import type { AttachmentStreamManifest } from "@/services/crypto/attachment-stream";

export type DownloadStatus = "idle" | "downloading" | "done" | "error" | "cancelled";

export interface UseAttachmentDownloadOptions {
  messageId: string;
  contentHash: string;
  totalChunks: number;
  encryptionKey: CryptoKey;
  manifest: AttachmentStreamManifest;
  ownerAddress: string;
  baseUrl?: string;
}

export interface UseAttachmentDownloadReturn {
  download: () => Promise<DownloadAttachmentResult>;
  cancel: () => void;
  status: DownloadStatus;
  progress: { chunksReceived: number; totalChunks: number; percent: number } | null;
  error: string | null;
  result: DownloadAttachmentResult | null;
  reset: () => void;
}

export function useAttachmentDownload(
  options: UseAttachmentDownloadOptions,
): UseAttachmentDownloadReturn {
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [progress, setProgress] = useState<{
    chunksReceived: number;
    totalChunks: number;
    percent: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DownloadAttachmentResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus("cancelled");
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(null);
    setError(null);
    setResult(null);
  }, []);

  const download = useCallback(async (): Promise<DownloadAttachmentResult> => {
    reset();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus("downloading");

    try {
      const downloadResult = await downloadAttachment({
        messageId: options.messageId,
        contentHash: options.contentHash,
        totalChunks: options.totalChunks,
        encryptionKey: options.encryptionKey,
        manifest: options.manifest,
        ownerAddress: options.ownerAddress,
        signal: controller.signal,
        baseUrl: options.baseUrl,
        onProgress: setProgress,
      });

      setResult(downloadResult);
      setStatus("done");
      return downloadResult;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("cancelled");
        throw err;
      }
      const message = err instanceof Error ? err.message : "Download failed";
      setError(message);
      setStatus("error");
      throw err;
    }
  }, [options, reset]);

  return { download, cancel, status, progress, error, result, reset };
}
