/**
 * Email Tone Rewriter — batch processing service.
 *
 * Pure service for rewriting multiple drafts in sequence. Collects results
 * and errors deterministically. No side effects, no network calls, no
 * mutations of input arrays.
 */

import { safeRewriteEmailTone, type SafeRewriteResult } from "./guards";
import type { RewriteRequest, ToneRewrite, RewriterErrorCode } from "./emailToneRewriter";

export interface BatchItem {
  index: number;
  request: RewriteRequest;
}

export interface BatchSuccess extends BatchItem {
  status: "success";
  rewrite: ToneRewrite;
}

export interface BatchError extends BatchItem {
  status: "error";
  code: RewriterErrorCode | "guard-rejection";
  message: string;
}

export type BatchResult = BatchSuccess | BatchError;

export interface BatchSummary {
  total: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  durationMs: number;
}

/**
 * Processes an array of drafts sequentially and returns results in input order.
 * Pure function: no side effects, no state mutation.
 */
export function processBatch(drafts: RewriteRequest[]): BatchResult[] {
  const results: BatchResult[] = [];

  for (let i = 0; i < drafts.length; i++) {
    const request = drafts[i];
    const result = safeRewriteEmailTone(request);

    if (result.status === "error") {
      const errorResult = result as SafeRewriteResult & { status: "error" };
      results.push({
        index: i,
        request,
        status: "error",
        code:
          "code" in errorResult
            ? (errorResult.code as RewriterErrorCode | "guard-rejection")
            : "unsupported-input",
        message: "message" in errorResult ? errorResult.message : "Unknown error",
      });
    } else {
      results.push({
        index: i,
        request,
        status: "success",
        rewrite: (result as { status: "ok"; rewrite: ToneRewrite }).rewrite,
      });
    }
  }

  return results;
}

/**
 * Processes drafts in parallel batches of a given size.
 * Returns results in input order.
 */
export function processBatchParallel(
  drafts: RewriteRequest[],
  batchSize: number = 5,
): BatchResult[] {
  const results: BatchResult[] = new Array(drafts.length);
  let index = 0;

  while (index < drafts.length) {
    const end = Math.min(index + batchSize, drafts.length);
    const batch = drafts.slice(index, end);

    for (let i = 0; i < batch.length; i++) {
      const request = batch[i];
      const result = safeRewriteEmailTone(request);

      if (result.status === "error") {
        const errorResult = result as SafeRewriteResult & { status: "error" };
        results[index + i] = {
          index: index + i,
          request,
          status: "error",
          code:
            "code" in errorResult
              ? (errorResult.code as RewriterErrorCode | "guard-rejection")
              : "unsupported-input",
          message: "message" in errorResult ? errorResult.message : "Unknown error",
        };
      } else {
        results[index + i] = {
          index: index + i,
          request,
          status: "success",
          rewrite: (result as { status: "ok"; rewrite: ToneRewrite }).rewrite,
        };
      }
    }

    index = end;
  }

  return results;
}

/**
 * Computes a summary of batch results.
 */
export function summarizeBatch(results: BatchResult[], startTime: number): BatchSummary {
  const total = results.length;
  const successCount = results.filter((r): r is BatchSuccess => r.status === "success").length;
  const errorCount = total - successCount;
  const durationMs = Date.now() - startTime;

  return {
    total,
    successCount,
    errorCount,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
    durationMs,
  };
}

/**
 * Filters batch results to only successful rewrites.
 */
export function successes(results: BatchResult[]): BatchSuccess[] {
  return results.filter((r): r is BatchSuccess => r.status === "success");
}

/**
 * Filters batch results to only failed rewrites.
 */
export function failures(results: BatchResult[]): BatchError[] {
  return results.filter((r): r is BatchError => r.status === "error");
}

/**
 * Groups batch results by tone for analysis.
 */
export function groupByTone(results: BatchResult[]): Record<string, BatchResult[]> {
  const groups: Record<string, BatchResult[]> = {};

  for (const result of results) {
    const tone = result.request.tone;
    if (!groups[tone]) {
      groups[tone] = [];
    }
    groups[tone].push(result);
  }

  return groups;
}

/**
 * Returns the average word count reduction across all successful rewrites.
 * Positive means the rewrite is shorter, negative means longer.
 */
export function averageReduction(results: BatchResult[]): number {
  const successful = successes(results);
  if (successful.length === 0) return 0;

  let totalReduction = 0;
  for (const result of successful) {
    const originalWords = result.rewrite.source.bodyText.split(/\s+/).filter(Boolean).length;
    const rewriteWords = result.rewrite.wordCount;
    totalReduction += originalWords - rewriteWords;
  }

  return Math.round(totalReduction / successful.length);
}

/**
 * Returns the most common error code across failed rewrites.
 */
export function mostCommonError(results: BatchResult[]): { code: string; count: number } | null {
  const failed = failures(results);
  if (failed.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const result of failed) {
    counts[result.code] = (counts[result.code] || 0) + 1;
  }

  let maxCode = "";
  let maxCount = 0;
  for (const [code, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCode = code;
      maxCount = count;
    }
  }

  return { code: maxCode, count: maxCount };
}

/**
 * Validates an array of drafts before batch processing.
 * Returns a map of index to validation errors for invalid drafts.
 */
export function validateBatch(drafts: RewriteRequest[]): Map<number, string[]> {
  const errors = new Map<number, string[]>();

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const draftErrors: string[] = [];

    if (!draft.bodyText || draft.bodyText.trim().length === 0) {
      draftErrors.push("Draft body is required.");
    }

    if (!draft.tone) {
      draftErrors.push("Tone is required.");
    }

    if (draft.subject && draft.subject.length > 200) {
      draftErrors.push("Subject exceeds 200 characters.");
    }

    if (draft.maxWords !== undefined) {
      if (!Number.isInteger(draft.maxWords) || draft.maxWords < 1) {
        draftErrors.push("maxWords must be a positive integer.");
      } else if (draft.maxWords > 2000) {
        draftErrors.push("maxWords must not exceed 2000.");
      }
    }

    if (draftErrors.length > 0) {
      errors.set(i, draftErrors);
    }
  }

  return errors;
}

/**
 * Deduplicates an array of drafts by body text.
 * Keeps the first occurrence of each unique body.
 */
export function deduplicateDrafts(drafts: RewriteRequest[]): RewriteRequest[] {
  const seen = new Set<string>();
  const unique: RewriteRequest[] = [];

  for (const draft of drafts) {
    const key = draft.bodyText.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(draft);
    }
  }

  return unique;
}

/**
 * Sorts drafts by body length (shortest first).
 */
export function sortByLength(drafts: RewriteRequest[]): RewriteRequest[] {
  return [...drafts].sort((a, b) => a.bodyText.length - b.bodyText.length);
}

/**
 * Sorts drafts by body length (longest first).
 */
export function sortByLengthDesc(drafts: RewriteRequest[]): RewriteRequest[] {
  return [...drafts].sort((a, b) => b.bodyText.length - a.bodyText.length);
}

/**
 * Applies a tone to all drafts in an array, returning new draft objects.
 * Does not mutate the input array.
 */
export function applyToneToAll(drafts: RewriteRequest[], tone: string): RewriteRequest[] {
  return drafts.map((d) => ({ ...d, tone: tone as RewriteRequest["tone"] }));
}

/**
 * Applies a maxWords constraint to all drafts in an array.
 * Does not mutate the input array.
 */
export function applyMaxWordsToAll(drafts: RewriteRequest[], maxWords: number): RewriteRequest[] {
  return drafts.map((d) => ({ ...d, maxWords }));
}
