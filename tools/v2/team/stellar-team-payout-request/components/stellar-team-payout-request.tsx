import { useState, useCallback } from "react";
import type { PayoutRequest, PayoutFormValues } from "../types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PayoutRequestForm,
  PayoutRequestList,
  SuccessState,
} from "./index";

type ViewState = "list" | "form" | "loading" | "error" | "success";

interface StellarTeamPayoutRequestProps {
  payouts?: PayoutRequest[];
  isLoading?: boolean;
  error?: string | null;
  onSubmit?: (values: PayoutFormValues) => Promise<void>;
}

/**
 * StellarTeamPayoutRequest — main tool component.
 *
 * Manages view transitions between list, form, loading, error and success.
 *
 * Accessibility:
 * - Sticky header with h1, consistent landmark structure
 * - ARIA live region for state-change announcements
 * - Focus management: "New request" button, back link
 * - All interactive elements keyboard-reachable
 */
export function StellarTeamPayoutRequest({
  payouts = [],
  isLoading = false,
  error: initialError = null,
  onSubmit,
}: StellarTeamPayoutRequestProps) {
  const [view, setView] = useState<ViewState>(
    isLoading ? "loading" : initialError ? "error" : "list",
  );
  const [error, setError] = useState<string | null>(initialError);
  const [lastSubmitted, setLastSubmitted] = useState<PayoutFormValues | null>(null);

  const announce = useCallback((message: string) => {
    const el = document.createElement("div");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.className = "sr-only";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }, []);

  const handleNewRequest = useCallback(() => {
    setView("form");
    announce("Payout request form opened");
  }, [announce]);

  const handleCancel = useCallback(() => {
    setView("list");
    setError(null);
    announce("Payout request form closed");
  }, [announce]);

  const handleSubmit = useCallback(
    async (values: PayoutFormValues) => {
      setView("loading");
      try {
        await onSubmit?.(values);
        setLastSubmitted(values);
        setView("success");
        announce("Payout request submitted successfully");
        setTimeout(() => setView("list"), 4000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
        setError(msg);
        setView("error");
        announce(`Error: ${msg}`);
      }
    },
    [onSubmit, announce],
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setView("list");
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Team Payout Requests</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Submit and track Stellar payment requests for your team
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {view === "loading" && <LoadingState />}

        {view === "error" && error && (
          <ErrorState
            icon="⚠️"
            title="Something went wrong"
            details={error}
            action={
              <button
                onClick={handleRetry}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Go Back
              </button>
            }
          />
        )}

        {view === "success" && lastSubmitted && (
          <SuccessState
            icon="✅"
            title="Request Submitted"
            details={`Your payout request of ${lastSubmitted.amount} XLM to ${lastSubmitted.recipientName} has been submitted on ${lastSubmitted.network}.`}
          />
        )}

        {view === "form" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Back to payout requests list"
            >
              ← Back
            </button>
            <PayoutRequestForm onSubmit={handleSubmit} onCancel={handleCancel} />
          </div>
        )}

        {view === "list" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {payouts.length > 0 ? `All Requests (${payouts.length})` : "Payout Requests"}
              </h2>
              <button
                type="button"
                onClick={handleNewRequest}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Create a new payout request"
              >
                + New Request
              </button>
            </div>

            {payouts.length === 0 ? (
              <EmptyState
                icon="💸"
                title="No Payout Requests"
                description="No payout requests have been made yet. Create one to get started."
                action={
                  <button
                    type="button"
                    onClick={handleNewRequest}
                    className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    New Request
                  </button>
                }
              />
            ) : (
              <PayoutRequestList payouts={payouts} />
            )}
          </div>
        )}
      </main>

      {/* Global ARIA live region */}
      <div role="region" aria-live="polite" aria-label="Status messages" className="sr-only" />
    </div>
  );
}

export type { StellarTeamPayoutRequestProps };
