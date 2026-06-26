/**
 * useOptimisticAction
 *
 * Hook for optimistic UI updates with animated rollback support.
 * Provides immediate feedback before server confirmation, and
 * visibly rolls back if the action fails.
 *
 * Usage:
 *   const { execute, rollback } = useOptimisticAction({
 *     onAction: (id) => updateEmail(id, { folder: "archive" }),
 *     onRollback: (id, prevState) => updateEmail(id, prevState),
 *     onError: (message) => showToast(message, { tone: "danger" }),
 *   });
 */

import { useCallback, useRef, useState } from "react";

export type OptimisticActionState =
  | { status: "idle" }
  | { status: "optimistic" }
  | { status: "confirmed" }
  | { status: "rolled-back"; error: string };

export type UseOptimisticActionOptions<TId, TState> = {
  /** The optimistic update to apply immediately. */
  onAction: (id: TId) => void;
  /** Revert the optimistic update. Receives the original state captured before the action. */
  onRollback: (id: TId, prevState: TState) => void;
  /** Called when an error occurs during rollback. */
  onError?: (message: string) => void;
};

export function useOptimisticAction<TId, TState>(
  options: UseOptimisticActionOptions<TId, TState>,
) {
  const { onAction, onRollback, onError } = options;
  const [state, setState] = useState<OptimisticActionState>({ status: "idle" });
  const prevStatesRef = useRef<Map<string, TState>>(new Map());

  const execute = useCallback(
    (id: TId, getPrevState: () => TState) => {
      // Capture the current state before the optimistic update
      const key = String(id);
      prevStatesRef.current.set(key, getPrevState());

      // Apply the optimistic update immediately
      onAction(id);
      setState({ status: "optimistic" });
    },
    [onAction],
  );

  const confirm = useCallback(() => {
    setState({ status: "confirmed" });
    prevStatesRef.current.clear();
  }, []);

  const revert = useCallback(
    (id: TId, errorMessage: string, customPrevState?: TState) => {
      const key = String(id);
      const prevState = customPrevState ?? prevStatesRef.current.get(key);

      if (prevState !== undefined) {
        onRollback(id, prevState);
      }

      prevStatesRef.current.delete(key);
      setState({ status: "rolled-back", error: errorMessage });
      onError?.(errorMessage);
    },
    [onRollback, onError],
  );

  return {
    state,
    execute,
    confirm,
    revert,
    /** True while the action is in its optimistic phase. */
    isPending: state.status === "optimistic",
  } as const;
}