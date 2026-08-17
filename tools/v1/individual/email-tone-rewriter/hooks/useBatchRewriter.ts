/**
 * useBatchRewriter — React hook for batch-rewriting multiple drafts.
 *
 * Accepts an array of drafts and rewrites each one sequentially, collecting
 * results and errors. Useful for processing a selection of emails at once.
 */

import { useState, useCallback, useRef } from "react";
import {
  rewriteEmailTone,
  type RewriteRequest,
  type ToneRewrite,
  type RewriterErrorCode,
} from "../services/emailToneRewriter";
import { safeRewriteEmailTone } from "../services/guards";

export interface BatchItem {
  /** Index in the original input array. */
  index: number;
  /** The draft that was submitted. */
  request: RewriteRequest;
}

export interface BatchSuccessItem extends BatchItem {
  status: "success";
  rewrite: ToneRewrite;
}

export interface BatchErrorItem extends BatchItem {
  status: "error";
  code: RewriterErrorCode | "guard-rejection";
  message: string;
}

export type BatchResultItem = BatchSuccessItem | BatchErrorItem;

export type BatchStatus = "idle" | "running" | "completed" | "cancelled";

export interface UseBatchRewriterReturn {
  /** Current batch processing status. */
  status: BatchStatus;
  /** Results collected so far, in input order. */
  results: BatchResultItem[];
  /** Number of drafts that have been processed. */
  processed: number;
  /** Total number of drafts in the batch. */
  total: number;
  /** Number of successful rewrites. */
  successCount: number;
  /** Number of failed rewrites. */
  errorCount: number;
  /** Starts processing the given array of drafts. */
  run: (drafts: RewriteRequest[]) => void;
  /** Cancels an in-progress batch. Already-completed results are preserved. */
  cancel: () => void;
  /** Clears all results and resets to idle. */
  reset: () => void;
}

export function useBatchRewriter(): UseBatchRewriterReturn {
  const [status, setStatus] = useState<BatchStatus>("idle");
  const [results, setResults] = useState<BatchResultItem[]>([]);
  const cancelledRef = useRef(false);

  const run = useCallback((drafts: RewriteRequest[]) => {
    cancelledRef.current = false;
    setStatus("running");
    setResults([]);

    const collected: BatchResultItem[] = [];

    for (let i = 0; i < drafts.length; i++) {
      if (cancelledRef.current) {
        setStatus("cancelled");
        setResults(collected);
        return;
      }

      const request = drafts[i];
      const result = safeRewriteEmailTone(request);

      if (result.status === "error") {
        const errorResult = result as {
          status: "error";
          code: RewriterErrorCode | "guard-rejection";
          message: string;
        };
        collected.push({
          index: i,
          request,
          status: "error",
          code: errorResult.code,
          message: errorResult.message,
        });
      } else {
        collected.push({
          index: i,
          request,
          status: "success",
          rewrite: result.rewrite,
        });
      }
    }

    setResults(collected);
    setStatus(cancelledRef.current ? "cancelled" : "completed");
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setStatus("cancelled");
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setStatus("idle");
    setResults([]);
  }, []);

  const successCount = results.filter((r): r is BatchSuccessItem => r.status === "success").length;
  const errorCount = results.filter((r): r is BatchErrorItem => r.status === "error").length;

  return {
    status,
    results,
    processed: results.length,
    total: results.length,
    successCount,
    errorCount,
    run,
    cancel,
    reset,
  };
}
