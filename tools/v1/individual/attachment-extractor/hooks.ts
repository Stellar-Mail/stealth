/**
 * Attachment Extractor - React Hooks
 * Local state management for extraction operations
 */

import { useState, useCallback, useRef } from "react";
import type {
  Attachment,
  ExtractionOptions,
  ExtractionResult,
  ExtractionState,
  LoadingState,
  UseExtractorReturn,
} from "./types";
import { extractAttachments } from "./services";

const INITIAL_STATE: ExtractionState = {
  files: [],
  loadingState: "idle",
  error: null,
  selectedIds: new Set(),
  stats: {
    totalProcessed: 0,
    successfulExtractions: 0,
    failedExtractions: 0,
    totalSize: 0,
    byCategory: {
      image: 0,
      document: 0,
      archive: 0,
      video: 0,
      audio: 0,
      other: 0,
    },
  },
};

/**
 * Hook for managing attachment extraction
 */
export function useExtractor(initialOptions?: ExtractionOptions): UseExtractorReturn {
  const [state, setState] = useState<ExtractionState>(INITIAL_STATE);
  const lastResultRef = useRef<ExtractionResult | null>(null);

  /**
   * Extract attachments from files
   */
  const extract = useCallback(
    async (files: File[], options?: ExtractionOptions): Promise<ExtractionResult> => {
      setState((prev) => ({
        ...prev,
        loadingState: "loading" as LoadingState,
        error: null,
      }));

      try {
        const result = await extractAttachments(files, options || initialOptions);
        lastResultRef.current = result;

        setState((prev) => ({
          ...prev,
          files: [...prev.files, ...result.attachments],
          loadingState: result.success ? ("success" as LoadingState) : ("error" as LoadingState),
          error:
            result.errors.length > 0 ? `${result.errors.length} files failed to extract` : null,
          stats: result.stats,
        }));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown extraction error";
        setState((prev) => ({
          ...prev,
          loadingState: "error" as LoadingState,
          error: errorMessage,
        }));

        return {
          success: false,
          attachments: [],
          errors: [
            {
              filename: "extraction",
              reason: "unknown",
              message: errorMessage,
            },
          ],
          stats: INITIAL_STATE.stats,
        };
      }
    },
    [initialOptions],
  );

  /**
   * Select single attachment
   */
  const selectAttachment = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      selectedIds: new Set([...prev.selectedIds, id]),
    }));
  }, []);

  /**
   * Deselect single attachment
   */
  const deselectAttachment = useCallback((id: string) => {
    setState((prev) => {
      const newSelected = new Set(prev.selectedIds);
      newSelected.delete(id);
      return {
        ...prev,
        selectedIds: newSelected,
      };
    });
  }, []);

  /**
   * Select all attachments
   */
  const selectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedIds: new Set(prev.files.map((f) => f.id)),
    }));
  }, []);

  /**
   * Deselect all attachments
   */
  const deselectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedIds: new Set(),
    }));
  }, []);

  /**
   * Remove single attachment
   */
  const removeAttachment = useCallback((id: string) => {
    setState((prev) => {
      const newFiles = prev.files.filter((f) => f.id !== id);
      const newSelected = new Set(prev.selectedIds);
      newSelected.delete(id);

      return {
        ...prev,
        files: newFiles,
        selectedIds: newSelected,
      };
    });
  }, []);

  /**
   * Clear all attachments
   */
  const clearAll = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  /**
   * Download single attachment
   */
  const downloadAttachment = useCallback(
    (id: string) => {
      const attachment = state.files.find((f) => f.id === id);
      if (attachment) {
        triggerDownload(attachment);
      }
    },
    [state.files],
  );

  /**
   * Download selected attachments
   */
  const downloadSelected = useCallback(() => {
    const selected = state.files.filter((f) => state.selectedIds.has(f.id));
    if (selected.length === 1) {
      triggerDownload(selected[0]);
    } else if (selected.length > 1) {
      // Download multiple as archive simulation
      selected.forEach((att) => {
        triggerDownload(att);
      });
    }
  }, [state.files, state.selectedIds]);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    lastResultRef.current = null;
  }, []);

  return {
    state,
    extract,
    selectAttachment,
    deselectAttachment,
    selectAll,
    deselectAll,
    removeAttachment,
    clearAll,
    downloadAttachment,
    downloadSelected,
    reset,
  };
}

/**
 * Helper to trigger download (mocked - would use actual download in real implementation)
 */
function triggerDownload(attachment: Attachment): void {
  // In real implementation, this would trigger actual download
  // For now, just log to console
  console.log(`Download triggered for: ${attachment.name}`);
}
