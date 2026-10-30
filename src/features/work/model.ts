import { useState } from "react";
import type { ThreadComment } from "@/tools/v1/team/internal-comment-thread/InternalCommentThread";

export type WorkView = "overview" | "mail" | "tasks" | "calendar" | "notes";
export type WorkTask = { id: string; title: string; emailId?: string; done: boolean };
export type WorkSession = { tasks: WorkTask[]; notes: Record<string, ThreadComment[]> };
const emptySession = (): WorkSession => ({ tasks: [], notes: {} });

// Preview access is not a paid entitlement. Production stays closed until a
// server-authorized subscription and shared storage exist.
export function canPreviewWork(isDemoMode: boolean, isDevelopment: boolean) {
  return isDemoMode || isDevelopment;
}

export function useWorkSession(owner: string) {
  const [state, setState] = useState<{ owner: string; session: WorkSession }>(() => ({
    owner,
    session: emptySession(),
  }));
  const session = state.owner === owner ? state.session : emptySession();
  const update = (mutate: (session: WorkSession) => WorkSession) => {
    setState((current) => ({
      owner,
      session: mutate(current.owner === owner ? current.session : emptySession()),
    }));
  };
  return { session, update };
}
