import { usePayoutRequest } from "../hooks/usePayoutRequest";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { PayoutForm } from "./PayoutForm";
import { PayoutSuccess } from "./PayoutSuccess";
import { PayoutSummary } from "./PayoutSummary";

export function StellarTeamPayoutRequest() {
  const { state, retry, create, reset } = usePayoutRequest();

  switch (state.status) {
    case "empty":
      return <EmptyState onCreate={create} />;

    case "loading":
      return <LoadingState />;

    case "error":
      return <ErrorState message={state.message} onRetry={retry} />;

    case "success":
      return (
        <div className="space-y-6">
          <PayoutSummary
            recipient={state.recipient}
            amount={state.amount}
            memo={state.memo}
            status="Ready"
          />

          <PayoutSuccess onCreateAnother={reset} />
        </div>
      );

    default:
      return <PayoutForm onSubmit={create} />;
  }
}
