// Project Mail Binder — module entry point
// All exports are local to this tool folder.

export { ProjectMailBinder } from "./components";
export type {
  BinderProject,
  BinderMail,
  BinderState,
  BinderStateEmpty,
  BinderStateLoading,
  BinderStateError,
  BinderStateSuccess,
  ProjectId,
  MailId,
  ProjectColor,
} from "./types";
export { isEmptyState, isLoadingState, isErrorState, isSuccessState, A11Y } from "./types";
export {
  seedProjects,
  seedMails,
  emptyState,
  loadingState,
  errorState,
  successState,
  stateByName,
} from "./fixtures/projects";

// Core logic exports
export { createProject, deleteProject, bindMail, unbindMail } from "./core";
export type { CreateProjectParams, BindMailParams, CoreDeps } from "./core";

export { LocalBinderService } from "./service";
