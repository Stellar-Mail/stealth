/**
 * useEmailToneRewriter — React hook for single-draft tone rewriting.
 *
 * Manages the full lifecycle of a rewrite interaction: input changes, tone
 * selection, rewrite execution, result display, loading/error states, and
 * reset. Delegates all business logic to the pure service layer.
 */

import { useState, useCallback, useRef } from "react";
import {
  rewriteEmailTone,
  type RewriteRequest,
  type ToneRewrite,
  type RewriterState,
  type RewriterErrorCode,
} from "../services/emailToneRewriter";
import { safeRewriteEmailTone } from "../services/guards";
import type { ToneId } from "../services/emailToneRewriter";

/** Default initial draft used by the hook on first mount. */
const EMPTY_DRAFT: RewriteRequest = {
  subject: "",
  bodyText: "",
  tone: "friendly",
};

export interface UseEmailToneRewriterOptions {
  /** Initial draft to populate the hook with. */
  initialDraft?: Partial<RewriteRequest>;
  /** Callback invoked when a rewrite completes successfully. */
  onSuccess?: (rewrite: ToneRewrite) => void;
  /** Callback invoked when a rewrite produces an error. */
  onError?: (code: RewriterErrorCode, message: string) => void;
}

export interface UseEmailToneRewriterReturn {
  /** Current draft being edited. */
  draft: RewriteRequest;
  /** Current lifecycle state. */
  state: RewriterState;
  /** Updates a single field of the draft. */
  updateDraft: (field: Partial<RewriteRequest>) => void;
  /** Sets the tone and immediately triggers a rewrite. */
  selectTone: (tone: ToneId) => void;
  /** Executes a rewrite with the current draft. */
  rewrite: () => void;
  /** Resets the draft to empty and state to idle. */
  reset: () => void;
  /** Whether a rewrite can be triggered (non-empty body, idle state). */
  canRewrite: boolean;
  /** Whether the current draft differs from the initial value. */
  isDirty: boolean;
}

export function useEmailToneRewriter(
  options: UseEmailToneRewriterOptions = {},
): UseEmailToneRewriterReturn {
  const { initialDraft = {}, onSuccess, onError } = options;

  const initial = { ...EMPTY_DRAFT, ...initialDraft };
  const [draft, setDraft] = useState<RewriteRequest>(initial);
  const [state, setState] = useState<RewriterState>({ status: "idle" });
  const initialRef = useRef(initial);
  const abortRef = useRef(false);

  const updateDraft = useCallback((field: Partial<RewriteRequest>) => {
    setDraft((prev) => ({ ...prev, ...field }));
    setState((prev) => (prev.status === "error" ? { status: "idle" } : prev));
  }, []);

  const selectTone = useCallback((tone: ToneId) => {
    setDraft((prev) => ({ ...prev, tone }));
  }, []);

  const rewrite = useCallback(() => {
    abortRef.current = false;
    setState({ status: "loading" });

    const result = safeRewriteEmailTone(draft);

    if (abortRef.current) {
      setState({ status: "idle" });
      return;
    }

    if (result.status === "error") {
      const errorResult = result as {
        status: "error";
        code: RewriterErrorCode;
        message: string;
      };
      setState({
        status: "error",
        code: errorResult.code,
        message: errorResult.message,
      });
      onError?.(errorResult.code, errorResult.message);
      return;
    }

    setState({ status: "ready", rewrite: result.rewrite });
    onSuccess?.(result.rewrite);
  }, [draft, onSuccess, onError]);

  const reset = useCallback(() => {
    abortRef.current = true;
    setDraft(initialRef.current);
    setState({ status: "idle" });
  }, []);

  const canRewrite = draft.bodyText.trim().length > 0 && state.status !== "loading";
  const isDirty =
    draft.bodyText !== initialRef.current.bodyText ||
    draft.subject !== initialRef.current.subject ||
    draft.tone !== initialRef.current.tone;

  return {
    draft,
    state,
    updateDraft,
    selectTone,
    rewrite,
    reset,
    canRewrite,
    isDirty,
  };
}
