/**
 * StellarPayoutRequestTool
 *
 * Main container component orchestrating the payout request flow.
 * Composes PayoutForm, PayoutStatusDisplay, and state components.
 *
 * This is a V2 isolated tool — do not wire into the main app, routing,
 * or Stellar core until a future integration issue explicitly permits it.
 */
import { useState } from "react";
import type { PayoutFormData } from "../types";
import { usePayoutRequest } from "../hooks";
import { PayoutForm } from "./payout-form";
import { PayoutStatusDisplay } from "./payout-status";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";
import { SuccessState } from "./success-state";
import { EmptyState } from "./empty-state";

type ViewMode = "form" | "status" | "success";

interface StellarPayoutRequestToolProps {
  /** Optional initial view override */
  initialView?: ViewMode;
  className?: string;
}

export function StellarPayoutRequestTool({
  initialView = "form",
  className,
}: StellarPayoutRequestToolProps) {
  const { payout, isSubmitting, error, submit, cancel, reset } = usePayoutRequest();
  const [view, setView] = useState<ViewMode>(initialView);

  async function handleSubmit(data: PayoutFormData) {
    await submit(data);
    if (!error) {
      setView("success");
    }
  }

  function handleNewRequest() {
    reset();
    setView("form");
  }

  if (isSubmitting) {
    return (
      <div className={className}>
        <LoadingState message="Submitting payout request…" itemCount={1} />
      </div>
    );
  }

  if (error && !payout) {
    return (
      <div className={className}>
        <ErrorState message={error} onRetry={handleNewRequest} />
      </div>
    );
  }

  if (view === "success" && payout) {
    return (
      <div className={className}>
        <SuccessState
          title="Payout request submitted"
          details={`Your payout of ${payout.amount} XLM to ${payout.recipientEmail} has been queued.`}
          action={
            <button
              onClick={handleNewRequest}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              New payout request
            </button>
          }
        />
        <div className="mt-6 px-4">
          <PayoutStatusDisplay payout={payout} onCancel={() => cancel()} />
        </div>
      </div>
    );
  }

  if (view === "status" && payout) {
    return (
      <div className={className}>
        <PayoutStatusDisplay
          payout={payout}
          onCancel={() => {
            cancel();
            handleNewRequest();
          }}
        />
      </div>
    );
  }

  // Default: form view (or empty state on first load before any request)
  if (!payout && view === "form") {
    return (
      <div className={className}>
        <EmptyState
          title="Request a team payout"
          description="Submit a Stellar payout request for your team. Your request will be queued for processing."
          action={null}
        />
        <div className="mt-6 max-w-lg mx-auto px-4">
          <PayoutForm onSubmit={handleSubmit} isLoading={isSubmitting} />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="max-w-lg mx-auto px-4">
        <PayoutForm onSubmit={handleSubmit} isLoading={isSubmitting} />
      </div>
    </div>
  );
}

export type { StellarPayoutRequestToolProps };
