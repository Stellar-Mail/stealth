import type { ReactNode } from "react";
import type { FetchState } from "../types";

interface FetchStateHandlerProps<T> {
  state: FetchState<T>;
  onRetry: () => void;
  loadingMessage?: string;
  emptyMessage?: string;
  errorMessage?: string;
  children: (data: T) => ReactNode;
}

export function FetchStateHandler<T>({
  state,
  onRetry,
  loadingMessage = "Loading...",
  emptyMessage = "No data found.",
  errorMessage = "Something went wrong.",
  children,
}: FetchStateHandlerProps<T>) {
  switch (state.status) {
    case "loading":
      return (
        <div
          className="flex items-center justify-center rounded-lg border border-[--border-subtle] bg-[--surface-primary] p-8"
          aria-busy="true"
          role="status"
        >
          <p className="text-sm text-[--text-secondary]">{loadingMessage}</p>
        </div>
      );

    case "empty":
      return (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[--border-subtle] bg-[--surface-primary] p-8"
          role="status"
        >
          <p className="text-sm text-[--text-secondary]">{emptyMessage}</p>
        </div>
      );

    case "error":
      return (
        <div
          className="flex flex-col items-center gap-3 rounded-lg border border-red-500/30 bg-red-900/10 p-6"
          role="alert"
        >
          <p className="text-sm text-red-400">
            {errorMessage} {state.message}
          </p>
          <button
            onClick={onRetry}
            className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
          >
            Retry
          </button>
        </div>
      );

    case "success":
      return <>{children(state.data)}</>;
  }
}
