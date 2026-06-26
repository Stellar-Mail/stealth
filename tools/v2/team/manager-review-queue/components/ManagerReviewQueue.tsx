import React, { useState, useEffect } from "react";
import type { ReviewItem, ReviewEngineState } from "../types";
import { fetchReviewQueue, updateReviewItemStatus } from "../services/reviewEngine";
import { ReviewQueueList } from "./ReviewQueueList";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { SuccessState } from "./SuccessState";

export const ManagerReviewQueue: React.FC = () => {
  const [state, setState] = useState<ReviewEngineState>({
    isLoading: true,
    error: null,
    items: [],
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadQueue = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetchReviewQueue({ filters: { status: "pending" } });
      setState({
        isLoading: false,
        error: null,
        items: response.items,
      });
    } catch (error) {
      setState({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load review queue",
        items: [],
      });
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleAction = async (id: string, action: "approved" | "rejected" | "escalated") => {
    try {
      await updateReviewItemStatus({ itemId: id, newStatus: action });
      setSuccessMessage(`Item ${id} was successfully ${action}.`);

      // Remove item from UI optimistically or reload queue
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Failed to update item ${id}. Please try again.`,
      }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Manager Review Queue</h1>
        <p className="text-gray-600">Review, approve, reject, or escalate pending requests.</p>
      </header>

      {successMessage && (
        <SuccessState message={successMessage} onDismiss={() => setSuccessMessage(null)} />
      )}

      {state.isLoading && <LoadingState />}

      {!state.isLoading && state.error && <ErrorState message={state.error} onRetry={loadQueue} />}

      {!state.isLoading && !state.error && state.items.length === 0 && <EmptyState />}

      {!state.isLoading && !state.error && state.items.length > 0 && (
        <ReviewQueueList
          items={state.items}
          onApprove={(id) => handleAction(id, "approved")}
          onReject={(id) => handleAction(id, "rejected")}
          onEscalate={(id) => handleAction(id, "escalated")}
        />
      )}
    </div>
  );
};
