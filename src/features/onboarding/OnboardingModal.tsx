import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useOnboarding } from "./useOnboarding";
import { useFreighter } from "./useFreighter";
import { IdentityStep } from "./steps/IdentityStep";
import { RecoveryStep } from "./steps/RecoveryStep";
import { AddressStep } from "./steps/AddressStep";
import { UnknownSenderRulesStep } from "./steps/UnknownSenderRulesStep";
import { MinimumPostageStep } from "./steps/MinimumPostageStep";
import { ReceiptPreferenceStep } from "./steps/ReceiptPreferenceStep";
import { PolicyReviewStep } from "./steps/PolicyReviewStep";
import type { OnboardingDraft, OnboardingStep } from "./types";

type Props = {
  open: boolean;
  onComplete: (walletAddress: string, draft: OnboardingDraft) => Promise<void>;
};

// Step transition: slides in from the direction of travel, exits opposite
const stepVariants: Variants = {
  enter: (direction: number) => ({ x: direction * 28, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.22, ease: [0, 0, 0.2, 1] } },
  exit: (direction: number) => ({
    x: direction * -28,
    opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  }),
};

function ProgressBar({ stepIndex, totalSteps }: { stepIndex: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-3 px-6 pt-5 pb-1">
      <div className="flex flex-1 gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className="h-0.5 flex-1 rounded-full transition-all duration-300"
            style={{
              background: i <= stepIndex ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
        {stepIndex + 1} / {totalSteps}
      </span>
    </div>
  );
}

function renderStep(step: OnboardingStep, props: StepProps): React.ReactNode {
  switch (step) {
    case "identity":
      return (
        <IdentityStep freighter={props.freighter} onAdvance={(patch) => props.onAdvance(patch)} />
      );
    case "recovery":
      return <RecoveryStep onAdvance={props.onAdvance} onRetreat={props.onRetreat} />;
    case "address":
      return (
        <AddressStep
          walletAddress={props.draft.walletAddress ?? ""}
          onAdvance={props.onAdvance}
          onRetreat={props.onRetreat}
        />
      );
    case "unknown-sender-rules":
      return (
        <UnknownSenderRulesStep
          draft={props.draft}
          onUpdate={props.onUpdate}
          onAdvance={props.onAdvance}
          onRetreat={props.onRetreat}
        />
      );
    case "minimum-postage":
      return (
        <MinimumPostageStep
          draft={props.draft}
          onUpdate={props.onUpdate}
          onAdvance={props.onAdvance}
          onRetreat={props.onRetreat}
        />
      );
    case "receipt-preference":
      return (
        <ReceiptPreferenceStep
          draft={props.draft}
          onUpdate={props.onUpdate}
          onAdvance={props.onAdvance}
          onRetreat={props.onRetreat}
        />
      );
    case "policy-review":
      return (
        <PolicyReviewStep
          draft={props.draft}
          isSubmitting={props.isSubmitting}
          submitError={props.submitError}
          onSubmit={props.onSubmit}
          onRetreat={props.onRetreat}
        />
      );
  }
}

type StepProps = {
  freighter: ReturnType<typeof useFreighter>;
  draft: OnboardingDraft;
  isSubmitting: boolean;
  submitError: string | null;
  onAdvance: (patch?: Partial<OnboardingDraft>) => void;
  onRetreat: () => void;
  onUpdate: (patch: Partial<OnboardingDraft>) => void;
  onSubmit: () => Promise<void>;
};

/**
 * OnboardingModal
 *
 * Renders a full-screen-blocking modal (no close button, no backdrop dismiss)
 * that gates access to the main app until the 7-step flow is complete.
 *
 * Orchestration responsibilities:
 * - Instantiates useOnboarding and useFreighter once at the top
 * - Passes only the minimum props each step needs
 * - Drives direction-aware AnimatePresence step transitions
 *
 * The modal does not gate itself on `open` by mounting/unmounting at the route
 * level. Instead it uses AnimatePresence so the exit animation plays before the
 * modal is removed from the DOM.
 */
export function OnboardingModal({ open, onComplete }: Props) {
  const freighter = useFreighter();
  const onboarding = useOnboarding({ onComplete });

  const stepProps: StepProps = {
    freighter,
    draft: onboarding.draft,
    isSubmitting: onboarding.isSubmitting,
    submitError: onboarding.submitError,
    onAdvance: onboarding.advance,
    onRetreat: onboarding.retreat,
    onUpdate: onboarding.update,
    onSubmit: onboarding.submit,
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Non-dismissible backdrop */}
          <motion.div
            key="onboarding-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
          />

          {/* Modal panel */}
          <motion.div
            key="onboarding-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-strong fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl"
          >
            <ProgressBar stepIndex={onboarding.stepIndex} totalSteps={onboarding.totalSteps} />

            {/* Step content area with direction-aware slide transition */}
            <div className="overflow-hidden px-6 pb-6 pt-4">
              <AnimatePresence mode="wait" custom={onboarding.direction}>
                <motion.div
                  key={onboarding.step}
                  custom={onboarding.direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {renderStep(onboarding.step, stepProps)}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
