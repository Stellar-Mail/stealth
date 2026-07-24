import { useCallback, useEffect, useState } from "react";
import type { AssignmentResult, LoadState } from "../types";
import { createMeetingAssignmentService } from "../services/meetingAssignmentService";

/**
 * Drives the Meeting Assignment UI state machine.
 *
 * Returns a LoadState<AssignmentResult> that moves through loading -> success
 * or loading -> error, plus a reload callback to run the assignment again. All
 * data comes from the folder-local service and fixtures; there is no network,
 * storage, or main-app dependency.
 */
export function useMeetingAssignments(): {
  state: LoadState<AssignmentResult>;
  reload: () => void;
} {
  const [state, setState] = useState<LoadState<AssignmentResult>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    const service = createMeetingAssignmentService({ simulateDelay: true });
    service
      .assign()
      .then((data) => {
        if (!cancelled) setState({ status: "success", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to assign meetings.";
          setState({ status: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { state, reload };
}
