export type MockPublishStatus =
  "idle" | "preview" | "publishing" | "published" | "failed" | "rolled-back";

export interface MockPublishStep {
  id: string;
  label: string;
  complete: boolean;
}

export interface MockPublishState {
  status: MockPublishStatus;
  draftCount: number;
  attempt: number;
  lastPublishedAt: string | null;
  rollbackAvailable: boolean;
  error: string | null;
  steps: MockPublishStep[];
}

export type MockPublishAction =
  | { type: "preview"; payload: { draftCount: number } }
  | { type: "start"; payload?: { now?: string } }
  | { type: "succeed"; payload: { now: string } }
  | { type: "fail"; payload: { message: string } }
  | { type: "retry" }
  | { type: "rollback" }
  | { type: "reset" };

const initialSteps: MockPublishStep[] = [
  { id: "validate", label: "Validate demo records", complete: false },
  { id: "snapshot", label: "Create local snapshot", complete: false },
  { id: "publish", label: "Simulate draft publish", complete: false },
];

export const initialMockPublishState: MockPublishState = {
  status: "idle",
  draftCount: 0,
  attempt: 0,
  lastPublishedAt: null,
  rollbackAvailable: false,
  error: null,
  steps: initialSteps,
};

export function mockPublishReducer(
  state: MockPublishState,
  action: MockPublishAction,
): MockPublishState {
  switch (action.type) {
    case "preview":
      return {
        ...initialMockPublishState,
        status: action.payload.draftCount > 0 ? "preview" : "idle",
        draftCount: Math.max(0, action.payload.draftCount),
      };
    case "start":
      if (state.draftCount === 0) {
        return {
          ...state,
          status: "failed",
          error: "Add at least one demo draft before publishing.",
        };
      }
      return {
        ...state,
        status: "publishing",
        attempt: state.attempt + 1,
        error: null,
        steps: markSteps(["validate", "snapshot"]),
        lastPublishedAt: action.payload?.now ?? state.lastPublishedAt,
      };
    case "succeed":
      return {
        ...state,
        status: "published",
        lastPublishedAt: action.payload.now,
        rollbackAvailable: true,
        error: null,
        steps: markSteps(["validate", "snapshot", "publish"]),
      };
    case "fail":
      return {
        ...state,
        status: "failed",
        error: action.payload.message,
        steps: markSteps(["validate", "snapshot"]),
      };
    case "retry":
      if (state.status !== "failed") {
        return state;
      }
      return {
        ...state,
        status: "publishing",
        attempt: state.attempt + 1,
        error: null,
        steps: markSteps(["validate", "snapshot"]),
      };
    case "rollback":
      if (!state.rollbackAvailable) {
        return state;
      }
      return {
        ...state,
        status: "rolled-back",
        rollbackAvailable: false,
        error: null,
        steps: initialSteps,
      };
    case "reset":
      return initialMockPublishState;
    default:
      return state;
  }
}

export function getMockPublishSummary(state: MockPublishState): string {
  if (state.status === "idle") {
    return "No demo drafts queued for mock publish.";
  }
  if (state.status === "preview") {
    return `${state.draftCount} demo draft${state.draftCount === 1 ? "" : "s"} ready for preview.`;
  }
  if (state.status === "publishing") {
    return `Mock publish attempt ${state.attempt} is running locally.`;
  }
  if (state.status === "published") {
    return `Mock publish completed for ${state.draftCount} demo draft${
      state.draftCount === 1 ? "" : "s"
    }.`;
  }
  if (state.status === "rolled-back") {
    return "Mock publish rolled back to the previous local snapshot.";
  }
  return state.error ?? "Mock publish failed.";
}

export function canStartMockPublish(state: MockPublishState): boolean {
  return state.status === "preview" && state.draftCount > 0;
}

export function canRetryMockPublish(state: MockPublishState): boolean {
  return state.status === "failed";
}

export function canRollbackMockPublish(state: MockPublishState): boolean {
  return state.rollbackAvailable;
}

function markSteps(completeIds: string[]): MockPublishStep[] {
  const completed = new Set(completeIds);
  return initialSteps.map((step) => ({
    ...step,
    complete: completed.has(step.id),
  }));
}
