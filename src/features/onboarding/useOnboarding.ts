import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_DRAFT,
  ONBOARDING_STEPS,
  draftToMailboxPolicy,
  type OnboardingDraft,
  type OnboardingStep,
} from "./types";

const STORAGE_KEY = "stealth-onboarding-v1";

type PersistedProgress = {
  step: OnboardingStep;
  draft: OnboardingDraft;
};

function loadProgress(): PersistedProgress {
  if (typeof window === "undefined") {
    return { step: "identity", draft: DEFAULT_DRAFT };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedProgress;
      // Guard against stale/corrupt data — fall back to identity step if step is unknown
      if (ONBOARDING_STEPS.includes(parsed.step)) return parsed;
    }
  } catch {
    // Ignore corrupt storage; start fresh
  }
  return { step: "identity", draft: DEFAULT_DRAFT };
}

export type OnboardingHook = {
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  draft: OnboardingDraft;
  direction: 1 | -1;
  isSubmitting: boolean;
  submitError: string | null;
  advance: (patch?: Partial<OnboardingDraft>) => void;
  retreat: () => void;
  update: (patch: Partial<OnboardingDraft>) => void;
  submit: () => Promise<void>;
};

/**
 * Manages the 7-step onboarding flow with:
 * - Resumability: progress is written to localStorage after every transition
 * - Direction tracking: step transitions animate left or right
 * - Submission: converts the draft to a MailboxPolicy and calls the provided handler
 *
 * Time complexity: all state transitions are O(1) — index arithmetic on a fixed array.
 * Space complexity: O(1) — draft has a fixed number of fields.
 */
export function useOnboarding(options: {
  onComplete: (walletAddress: string, draft: OnboardingDraft) => Promise<void>;
}): OnboardingHook {
  const [progress, setProgress] = useState<PersistedProgress>(loadProgress);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Persist to localStorage whenever progress changes
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore write failures (e.g. private browsing with no storage)
    }
  }, [progress]);

  const stepIndex = ONBOARDING_STEPS.indexOf(progress.step);
  const totalSteps = ONBOARDING_STEPS.length;

  const advance = useCallback((patch: Partial<OnboardingDraft> = {}) => {
    setDirection(1);
    setProgress((prev) => {
      const nextIndex = ONBOARDING_STEPS.indexOf(prev.step) + 1;
      const nextStep = ONBOARDING_STEPS[nextIndex] ?? prev.step;
      return { step: nextStep, draft: { ...prev.draft, ...patch } };
    });
  }, []);

  const retreat = useCallback(() => {
    setDirection(-1);
    setProgress((prev) => {
      const prevIndex = Math.max(0, ONBOARDING_STEPS.indexOf(prev.step) - 1);
      return { ...prev, step: ONBOARDING_STEPS[prevIndex] };
    });
  }, []);

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setProgress((prev) => ({ ...prev, draft: { ...prev.draft, ...patch } }));
  }, []);

  const submit = useCallback(async () => {
    const { walletAddress } = progress.draft;
    if (!walletAddress) {
      setSubmitError("No wallet address found. Please go back and reconnect.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Validate the draft can produce a valid policy before calling the handler
      draftToMailboxPolicy(progress.draft); // throws if invalid

      await options.onComplete(walletAddress, progress.draft);

      // Clear in-progress state only after a confirmed successful completion
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Non-critical: the app checks onboardingCompleted preference, not this key
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Mailbox activation failed. Please try again.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
    // Depend on options.onComplete (not the whole options object): callers pass
    // useOnboarding({ onComplete }) with a fresh object literal every render, so
    // depending on `options` rebuilt this callback on every render. Narrowing to
    // the function keeps `submit` stable while onComplete is stable.
  }, [options.onComplete, progress.draft]);

  return {
    step: progress.step,
    stepIndex,
    totalSteps,
    draft: progress.draft,
    direction,
    isSubmitting,
    submitError,
    advance,
    retreat,
    update,
    submit,
  };
}
