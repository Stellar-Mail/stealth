/**
 * BETA-067: Attachment download, decrypt, and verify hook.
 *
 * Manages the full lifecycle of fetching an encrypted attachment, decrypting
 * it with the envelope content key, verifying its integrity, and presenting
 * the result for preview or safe download.
 *
 * State machine: idle → loading → decrypting → ready | error
 *
 * BETA-031 dependency note: the API route for fetching encrypted attachment
 * chunks from R2 storage is not yet merged. This hook currently decrypts
 * attachment bytes that were sealed inline by `sealEnvelope()`. When BETA-031
 * lands, the `fetchAttachment` parameter would be replaced with a streaming
 * HTTP range fetch from the attachment API route.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { decryptAttachment, type DecryptAttachmentInput } from "@/services/crypto/open-envelope";
import { sanitizeFilenameForDisplay } from "@/services/crypto/attachment-metadata";

export type AttachmentDownloadState =
  | "idle"
  | "loading"
  | "decrypting"
  | "ready"
  | "error"
  | "unauthorized"
  | "offline"
  | "expired"
  | "oversized"
  | "corrupted";

export interface AttachmentDownloadError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AttachmentDownloadResult {
  /** Decrypted plaintext bytes. */
  bytes: Uint8Array;
  /** Object URL for the decrypted content (blob URL). Revoked on unmount. */
  blobUrl: string;
  /** Sanitized filename safe for filesystem save. */
  safeFilename: string;
  /** MIME type derived from the file extension. */
  mimeType: string;
  /** SHA-256 content hash of the decrypted bytes. */
  contentHash: string;
}

export interface UseAttachmentDownloadOptions {
  /** Attachment metadata from the email. */
  attachment: { name: string; size: string; type: string } | null;
  /** Encrypted ciphertext (base64) from the sealed envelope. */
  encryptedCiphertext?: string;
  /** Nonce (hex) from the attachment's encryption_metadata. */
  encryptedNonce?: string;
  /** MAC/tag (hex) from the attachment's encryption_metadata. */
  encryptedMac?: string;
  /** Expected content hash for integrity verification. */
  expectedContentHash?: string;
  /** The AES-GCM content key for decryption. */
  contentKey?: CryptoKey;
  /**
   * Function to fetch the encrypted attachment bytes.
   * When BETA-031 merges, this would call the attachment API route.
   * For now, it should return the inline ciphertext from the envelope.
   */
  fetchAttachment?: (signal?: AbortSignal) => Promise<{
    ciphertext: string;
    nonce: string;
    mac: string;
    contentHash?: string;
  }>;
  /** Whether the drawer is open (triggers auto-fetch). */
  isOpen?: boolean;
}

export interface UseAttachmentDownloadReturn {
  state: AttachmentDownloadState;
  result: AttachmentDownloadResult | null;
  error: AttachmentDownloadError | null;
  progress: number;
  startDownload: () => void;
  cancel: () => void;
  retry: () => void;
}

const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024; // 16 MiB

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    json: "application/json",
    txt: "text/plain",
    log: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    xml: "application/xml",
    html: "text/html",
    svg: "image/svg+xml",
    enc: "application/octet-stream",
    pgp: "application/octet-stream",
    gpg: "application/octet-stream",
    bin: "application/octet-stream",
    key: "application/octet-stream",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Check if a file type is safe to preview inline.
 * Risky/executable formats are forced into safe download only.
 */
export function isPreviewableType(type: string): boolean {
  const t = type.toLowerCase();
  return [
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "json",
    "txt",
    "log",
    "md",
    "csv",
    "xml",
  ].includes(t);
}

/**
 * Check if a file type is risky/executable and must never be previewed.
 */
export function isRiskyType(type: string): boolean {
  const t = type.toLowerCase();
  return [
    "exe",
    "bat",
    "cmd",
    "com",
    "msi",
    "scr",
    "pif",
    "js",
    "mjs",
    "cjs",
    "vbs",
    "vbe",
    "wsf",
    "wsh",
    "ps1",
    "psm1",
    "psd1",
    "sh",
    "bash",
    "zsh",
    "fish",
    "jar",
    "class",
    "py",
    "rb",
    "pl",
    "php",
    "dll",
    "so",
    "dylib",
    "docm",
    "xlsm",
    "pptm",
    "hta",
    "cpl",
    "inf",
    "reg",
    "rgs",
    "application/x-executable",
    "application/x-msdownload",
    "application/x-sh",
    "application/x-shellscript",
    "text/javascript",
    "application/javascript",
  ].includes(t);
}

/**
 * Parse a size string like "4.2 MB" into bytes.
 */
function parseSizeBytes(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  switch (unit) {
    case "B":
      return num;
    case "KB":
      return num * 1024;
    case "MB":
      return num * 1024 * 1024;
    case "GB":
      return num * 1024 * 1024 * 1024;
    default:
      return 0;
  }
}

export function useAttachmentDownload(
  options: UseAttachmentDownloadOptions,
): UseAttachmentDownloadReturn {
  const {
    attachment,
    encryptedCiphertext,
    encryptedNonce,
    encryptedMac,
    expectedContentHash,
    contentKey,
    fetchAttachment,
    isOpen = false,
  } = options;

  const [state, setState] = useState<AttachmentDownloadState>("idle");
  const [result, setResult] = useState<AttachmentDownloadResult | null>(null);
  const [error, setError] = useState<AttachmentDownloadError | null>(null);
  const [progress, setProgress] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Revoke blob URL on unmount or when result changes.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Reset state when attachment changes.
  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setResult(null);
    setError(null);
    setProgress(0);
    if (!isOpen || !attachment) {
      setState("idle");
    }
  }, [attachment?.name, isOpen]);

  const cleanup = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const doDownload = useCallback(async () => {
    if (!attachment || !contentKey) {
      setState("error");
      setError({
        code: "missing_key",
        message: "Encryption key not available for this attachment.",
        retryable: false,
      });
      return;
    }

    // Check offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState("offline");
      setError({
        code: "offline",
        message: "You are offline. Please check your connection and try again.",
        retryable: true,
      });
      return;
    }

    // Check file size
    const sizeBytes = parseSizeBytes(attachment.size);
    if (sizeBytes > MAX_ATTACHMENT_BYTES) {
      setState("oversized");
      setError({
        code: "oversized",
        message: `File size (${attachment.size}) exceeds the maximum supported size (16 MB).`,
        retryable: false,
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setState("loading");
      setProgress(0);
      setError(null);

      let ciphertext: string;
      let nonce: string;
      let mac: string;
      let contentHash: string | undefined;

      if (fetchAttachment) {
        // Use the provided fetch function (for API-based downloads).
        const fetched = await fetchAttachment(controller.signal);
        ciphertext = fetched.ciphertext;
        nonce = fetched.nonce;
        mac = fetched.mac;
        contentHash = fetched.contentHash;
      } else if (encryptedCiphertext && encryptedNonce && encryptedMac) {
        // Use inline ciphertext from the envelope.
        ciphertext = encryptedCiphertext;
        nonce = encryptedNonce;
        mac = encryptedMac;
        contentHash = expectedContentHash;
      } else {
        throw new Error("No attachment data available for download");
      }

      if (controller.signal.aborted) return;
      setProgress(50);

      setState("decrypting");

      const decryptInput: DecryptAttachmentInput = {
        ciphertext,
        nonce,
        mac,
        expectedContentHash: contentHash,
      };

      const decrypted = await decryptAttachment(contentKey, decryptInput);

      if (controller.signal.aborted) return;
      setProgress(90);

      // Verify content hash if we have one and it wasn't already checked.
      if (expectedContentHash && decrypted.contentHash !== expectedContentHash) {
        throw new Error("Content hash mismatch after decryption");
      }

      const mimeType = getMimeType(attachment.type);
      const blob = new Blob([decrypted.bytes.buffer as ArrayBuffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      const safeFilename = sanitizeFilenameForDisplay(attachment.name);

      setProgress(100);

      if (!mountedRef.current) return;

      setResult({
        bytes: decrypted.bytes,
        blobUrl,
        safeFilename,
        mimeType,
        contentHash: decrypted.contentHash,
      });
      setState("ready");
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      cleanup();

      if (err instanceof Error && err.name === "AbortError") {
        setState("idle");
        return;
      }

      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("unauthorized") || msg.includes("401") || msg.includes("403")) {
        setState("unauthorized");
        setError({
          code: "unauthorized",
          message:
            "You are not authorized to access this attachment. Your session may have expired.",
          retryable: false,
        });
      } else if (msg.includes("expired") || msg.includes("404")) {
        setState("expired");
        setError({
          code: "expired",
          message: "The download link has expired. Please request a new one.",
          retryable: true,
        });
      } else if (msg.includes("offline") || msg.includes("network") || msg.includes("fetch")) {
        setState("offline");
        setError({
          code: "offline",
          message: "Network error. Please check your connection and try again.",
          retryable: true,
        });
      } else if (
        msg.includes("integrity") ||
        msg.includes("hash mismatch") ||
        msg.includes("tampered")
      ) {
        setState("corrupted");
        setError({
          code: "corrupted",
          message:
            "Attachment data is corrupted or has been tampered with. Download aborted for safety.",
          retryable: false,
        });
      } else if (msg.includes("decryption failed") || msg.includes("wrong key")) {
        setState("corrupted");
        setError({
          code: "decryption_failed",
          message:
            "Decryption failed. The attachment may be corrupted or encrypted with a different key.",
          retryable: false,
        });
      } else {
        setState("error");
        setError({
          code: "unknown",
          message: `Failed to download attachment: ${msg}`,
          retryable: true,
        });
      }
    }
  }, [
    attachment,
    contentKey,
    encryptedCiphertext,
    encryptedNonce,
    encryptedMac,
    expectedContentHash,
    fetchAttachment,
    cleanup,
  ]);

  const startDownload = useCallback(() => {
    cleanup();
    doDownload();
  }, [cleanup, doDownload]);

  const cancel = useCallback(() => {
    cleanup();
    if (mountedRef.current) {
      setState("idle");
      setProgress(0);
    }
  }, [cleanup]);

  const retry = useCallback(() => {
    cleanup();
    if (mountedRef.current) {
      setResult(null);
      setError(null);
      setProgress(0);
    }
    doDownload();
  }, [cleanup, doDownload]);

  // Auto-fetch when drawer opens with valid data.
  useEffect(() => {
    if (isOpen && attachment && contentKey && state === "idle") {
      doDownload();
    }
  }, [isOpen, attachment, contentKey, state, doDownload]);

  return {
    state,
    result,
    error,
    progress,
    startDownload,
    cancel,
    retry,
  };
}
