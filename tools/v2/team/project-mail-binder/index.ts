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
  BinderErrorCode,
  BinderError,
  BinderResult,
  CreateProjectInput,
  CreateProjectOutput,
  DeleteProjectInput,
  DeleteProjectOutput,
  BindMailInput,
  BindMailOutput,
  UnbindMailInput,
  UnbindMailOutput,
  AutoBindInputEmail,
  AutoBindInput,
  AutoBindOutput,
  IBinderBackendService,
  Project,
  AutoBindingRule,
  ProjectMailBinding,
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
  validCreateProjectInputFixture,
  validBindMailInputFixture,
  validAutoBindInputFixture,
  invalidCreateInputEmptyNameFixture,
  invalidCreateInputColorFixture,
  notFoundProjectIdFixture,
  notFoundMailIdFixture,
  duplicateProjectInputFixture,
  invalidStateErrorFixture,
} from "./fixtures/projects";

// Core logic exports
export { createProject, deleteProject, bindMail, unbindMail } from "./core";
export type { CreateProjectParams, BindMailParams, CoreDeps } from "./core";

export { LocalBinderService } from "./service";
export { ProjectBinderService } from "./services/projectBinderService";
export { ProjectMailBinderBackendService } from "./services/binderBackendService";
