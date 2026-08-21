export type ProjectId = string;
export type MailId = string;

export type ProjectColor = "blue" | "purple" | "green" | "amber" | "rose" | "cyan";

export type BinderProject = {
  id: ProjectId;
  name: string;
  description: string;
  color: ProjectColor;
  mailCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BinderMail = {
  id: MailId;
  projectId: ProjectId;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
};

// ---------------------------------------------------------------------------
// State machine — discriminated union
// ---------------------------------------------------------------------------

export type BinderStateEmpty = { status: "empty" };
export type BinderStateLoading = { status: "loading" };
export type BinderStateError = { status: "error"; message: string };
export type BinderStateSuccess = {
  status: "success";
  projects: BinderProject[];
  mails: BinderMail[];
};

export type BinderState =
  BinderStateEmpty | BinderStateLoading | BinderStateError | BinderStateSuccess;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isEmptyState(s: BinderState): s is BinderStateEmpty {
  return s.status === "empty";
}

export function isLoadingState(s: BinderState): s is BinderStateLoading {
  return s.status === "loading";
}

export function isErrorState(s: BinderState): s is BinderStateError {
  return s.status === "error";
}

export function isSuccessState(s: BinderState): s is BinderStateSuccess {
  return s.status === "success";
}

// ---------------------------------------------------------------------------
// Accessibility constants
// ---------------------------------------------------------------------------

export const A11Y = {
  containerLabel: "Project Mail Binder",
  liveRegion: "polite" as const,
  loadingText: "Loading projects…",
  emptyHeading: "No project binders yet",
  emptyCta: "Create your first project binder",
  errorHeading: "Something went wrong",
  retryLabel: "Retry loading projects",
  projectListLabel: "Project binders",
  projectDetailLabel: (name: string) => `Project: ${name}`,
  mailListLabel: (name: string) => `Emails in ${name}`,
  keys: {
    ENTER: "Enter",
    SPACE: " ",
    ESCAPE: "Escape",
    ARROW_UP: "ArrowUp",
    ARROW_DOWN: "ArrowDown",
  },
} as const;

export interface AutoBindingRule {
  id: string;
  type: "subject" | "sender" | "body";
  pattern: string;
  isActive: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  stellarAddress?: string;
  stellarAssetCode?: string;
  members: string[];
  rules: AutoBindingRule[];
  createdAt: string;
}

export interface ProjectMailBinding {
  projectId: string;
  emailId: string;
  boundAt: string;
  boundBy: string;
  bindingType: "automatic" | "manual";
}

// ---------------------------------------------------------------------------
// Backend Execution Contract & Error Codes
// ---------------------------------------------------------------------------

export type BinderErrorCode =
  | "INVALID_INPUT"
  | "PROJECT_NOT_FOUND"
  | "MAIL_NOT_FOUND"
  | "INVALID_STATE"
  | "DUPLICATE_PROJECT"
  | "RULE_EVALUATION_ERROR"
  | "UNHANDLED_ERROR";

export interface BinderError {
  code: BinderErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type BinderResult<T> = { success: true; data: T } | { success: false; error: BinderError };

// DTO Inputs
export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: ProjectColor;
  stellarAddress?: string;
  stellarAssetCode?: string;
  members?: string[];
  rules?: AutoBindingRule[];
}

export interface DeleteProjectInput {
  projectId: ProjectId;
}

export interface BindMailInput {
  projectId: ProjectId;
  subject: string;
  sender: string;
  date?: string;
  snippet?: string;
  body?: string;
  bindingType?: "automatic" | "manual";
  boundBy?: string;
}

export interface UnbindMailInput {
  mailId: MailId;
  projectId?: ProjectId;
}

export interface AutoBindInputEmail {
  id: string;
  from: string;
  email: string;
  subject: string;
  preview?: string;
  body?: string;
  time?: string;
}

export interface AutoBindInput {
  emails: AutoBindInputEmail[];
}

// DTO Outputs
export interface CreateProjectOutput {
  project: BinderProject;
  state: BinderState;
}

export interface DeleteProjectOutput {
  deletedProjectId: ProjectId;
  removedMailCount: number;
  state: BinderState;
}

export interface BindMailOutput {
  mail: BinderMail;
  state: BinderState;
}

export interface UnbindMailOutput {
  unboundMailId: MailId;
  state: BinderState;
}

export interface AutoBindOutput {
  createdBindings: ProjectMailBinding[];
  boundEmailCount: number;
}

// Backend Execution Boundary Interface
export interface IBinderBackendService {
  getState(): Promise<BinderResult<BinderState>>;
  createProject(input: CreateProjectInput): Promise<BinderResult<CreateProjectOutput>>;
  deleteProject(input: DeleteProjectInput): Promise<BinderResult<DeleteProjectOutput>>;
  bindMail(input: BindMailInput): Promise<BinderResult<BindMailOutput>>;
  unbindMail(input: UnbindMailInput): Promise<BinderResult<UnbindMailOutput>>;
  autoBindMails(input: AutoBindInput): Promise<BinderResult<AutoBindOutput>>;
}
