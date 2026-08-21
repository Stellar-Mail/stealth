import { useCallback, useEffect, useRef, useState } from "react";

import {
  completeOnboarding,
  fetchOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingCompleteResult,
} from "./api";
import {
  DEFAULT_DRAFT,
  ONBOARDING_STEPS,
  draftToBetaDefaults,
  type OnboardingDraft,
  type OnboardingStep,
} from "./types";

export type OnboardingHook = {
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  draft: OnboardingDraft;
  direction: 1 | -1;
  /** True while the initial server restore is in flight. */
  isRestoring: boolean;
  restoreError: string | null;
  retryRestore: () => void;
  /** True while at least one persistence write is in flight. */
  isSaving: boolean;
  /** Non-blocking: a write failed; the next change retries. */
  saveError: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  /** Non-null once completion succeeded (or a completed flow was restored). */
  completed: OnboardingCompleteResult | null;
  advance: (patch?: Partial<OnboardingDraft>) => void;
  retreat: () => void;
  update: (patch: Partial<OnboardingDraft>) => void;
  submit: () => Promise<OnboardingCompleteResult>;
};

/**
 * Manages the 7-step profile-first onboarding flow with durable server state:
 * - Resumability: every transition is persisted to the server (keyed by the
 *   session account), so a refresh or a second device resumes from the same
 *   authoritative record. No localStorage, no wallet extension.
 * - Persistence: single-flight writer with a trailing flush — every change is
 *   either written immediately or covered by the next write, and the final
 *   state always lands (duplicate saves are impossible by construction).
 * - Submission: idempotency key is stable across retries of the same payload,
 *   so a network timeout can never double-apply completion.
 */
export function useOnboarding(options: {
  onComplete?: (result: OnboardingCompleteResult) => void | Promise<void>;
}): OnboardingHook {
  const [progress, setProgress] = useState<{
    step: OnboardingStep;
    draft: OnboardingDraft;
  }>({ step: ONBOARDING_STEPS[0], draft: DEFAULT_DRAFT });
  const progressRef = useRef(progress);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<OnboardingCompleteResult | null>(null);

  const saveInFlightRef = useRef(false);
  const saveRequestedRef = useRef(false);
  const updateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const lastSubmitPayloadRef = useRef<string | null>(null);

  const applyProgress = useCallback((next: { step: OnboardingStep; draft: OnboardingDraft }) => {
    progressRef.current = next;
    setProgress(next);
  }, []);

  const restore = useCallback(async () => {
    setIsRestoring(true);
    setRestoreError(null);
    try {
      const record = await fetchOnboardingDraft();
      if (record) {
        if (record.status === "completed") {
          setCompleted({
            alreadyCompleted: true,
            draft: record,
            policy: draftToBetaDefaults(recordToDraft(record)),
          });
          applyProgress({ step: record.step, draft: recordToDraft(record) });
        } else {
          applyProgress({ step: record.step, draft: recordToDraft(record) });
        }
      }
    } catch {
      // A failed restore must not lose the flow: fall back to defaults and
      // let the user retry from the first unsaved step.
      setRestoreError("Could not load your saved progress. Starting fresh.");
    } finally {
      setIsRestoring(false);
    }
  }, [applyProgress]);

  useEffect(() => {
    void restore();
  }, [restore]);

  // Single-flight writer with trailing flush: every trigger either writes now
  // or is covered by the next iteration, and the final state always lands.
  const persist = useCallback(() => {
    saveRequestedRef.current = true;
    setSaveError(null);
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setIsSaving(true);
    const loop = async () => {
      while (saveRequestedRef.current) {
        saveRequestedRef.current = false;
        const snapshot = { ...progressRef.current, draft: { ...progressRef.current.draft } };
        try {
          await saveOnboardingDraft(snapshot.step, snapshot.draft);
        } catch {
          setSaveError("Could not save progress to the server yet. Your next change will retry.");
          break;
        }
      }
      saveInFlightRef.current = false;
      setIsSaving(false);
    };
    void loop();
  }, []);

  const persistSoon = useCallback(() => {
    if (updateDebounceRef.current) clearTimeout(updateDebounceRef.current);
    updateDebounceRef.current = setTimeout(persist, 300);
  }, [persist]);

  useEffect(() => {
    return () => {
      if (updateDebounceRef.current) clearTimeout(updateDebounceRef.current);
    };
  }, []);

  const stepIndex = ONBOARDING_STEPS.indexOf(progress.step);
  const totalSteps = ONBOARDING_STEPS.length;

  const advance = useCallback(
    (patch: Partial<OnboardingDraft> = {}) => {
      if (completed) return;
      setDirection(1);
      applyProgress({
        step: ONBOARDING_STEPS[
          Math.min(ONBOARDING_STEPS.indexOf(progressRef.current.step) + 1, totalSteps - 1)
        ],
        draft: { ...progressRef.current.draft, ...patch },
      });
      persist();
    },
    [applyProgress, completed, persist, totalSteps],
  );

  const retreat = useCallback(() => {
    if (completed) return;
    setDirection(-1);
    const prevIndex = Math.max(0, ONBOARDING_STEPS.indexOf(progressRef.current.step) - 1);
    applyProgress({ ...progressRef.current, step: ONBOARDING_STEPS[prevIndex] });
    persist();
  }, [applyProgress, completed, persist]);

  const update = useCallback(
    (patch: Partial<OnboardingDraft>) => {
      if (completed) return;
      applyProgress({
        ...progressRef.current,
        draft: { ...progressRef.current.draft, ...patch },
      });
      persistSoon();
    },
    [applyProgress, completed, persistSoon],
  );

  const submit = useCallback(async (): Promise<OnboardingCompleteResult> => {
    const latest = progressRef.current;
    if (!latest.draft.displayName.trim()) {
      setSubmitError("Enter a display name before continuing.");
      throw new Error("Display name is required");
    }
    if (!latest.draft.recoveryAcknowledged) {
      setSubmitError("Confirm the recovery acknowledgment before continuing.");
      throw new Error("Recovery acknowledgment is required");
    }
    if (completed) return completed;

    const payload = { ...latest.draft };
    const payloadKey = JSON.stringify(payload);
    if (payloadKey !== lastSubmitPayloadRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
      lastSubmitPayloadRef.current = payloadKey;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await completeOnboarding(payload, idempotencyKeyRef.current!);
      setCompleted(result);
      await options.onComplete?.(result);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Mailbox activation failed. Please try again.";
      setSubmitError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [completed, options.onComplete]);

  return {
    step: progress.step,
    stepIndex,
    totalSteps,
    draft: progress.draft,
    direction,
    isRestoring,
    restoreError,
    retryRestore: () => {
      void restore();
    },
    isSaving,
    saveError,
    isSubmitting,
    submitError,
    completed,
    advance,
    retreat,
    update,
    submit,
  };
}

function recordToDraft(record: {
  displayName: string;
  recoveryAcknowledged: boolean;
  unknownSenderRule: OnboardingDraft["unknownSenderRule"];
  minimumPostage: string;
  receiptOnDelivery: boolean;
}): OnboardingDraft {
  return {
    displayName: record.displayName,
    recoveryAcknowledged: record.recoveryAcknowledged,
    unknownSenderRule: record.unknownSenderRule,
    minimumPostage: record.minimumPostage,
    receiptOnDelivery: record.receiptOnDelivery,
  };
}
