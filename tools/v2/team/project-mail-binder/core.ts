import type {
  BinderProject,
  BinderMail,
  BinderStateEmpty,
  BinderStateSuccess,
  BinderStateError,
  ProjectId,
  MailId,
  ProjectColor,
} from "./types";

export type CoreDeps = {
  generateId: (prefix: "proj" | "mail") => string;
  now: () => string; // ISO date string
};

export type CreateProjectParams = {
  name: string;
  description: string;
  color: ProjectColor;
};

export type BindMailParams = {
  subject: string;
  sender: string;
  date: string;
  snippet: string;
};

/**
 * Pure function to create a new project in the binder state.
 * Returns a new state containing the added project.
 */
export function createProject(
  state: BinderStateSuccess | BinderStateEmpty,
  params: CreateProjectParams,
  deps: CoreDeps,
): BinderStateSuccess | BinderStateError {
  if (!params.name.trim()) {
    return { status: "error", message: "Project name cannot be empty." };
  }

  const newProject: BinderProject = {
    id: deps.generateId("proj"),
    name: params.name.trim(),
    description: params.description.trim(),
    color: params.color,
    mailCount: 0,
    createdAt: deps.now(),
    updatedAt: deps.now(),
  };

  const projects = state.status === "success" ? [...state.projects] : [];
  const mails = state.status === "success" ? [...state.mails] : [];

  projects.push(newProject);

  return {
    status: "success",
    projects,
    mails,
  };
}

/**
 * Pure function to delete a project and its bound mails.
 * Returns a new state with the project and associated mails removed.
 * Returns an empty state if no projects remain.
 */
export function deleteProject(
  state: BinderStateSuccess,
  projectId: ProjectId,
): BinderStateSuccess | BinderStateEmpty | BinderStateError {
  const projectExists = state.projects.some((p) => p.id === projectId);
  if (!projectExists) {
    return { status: "error", message: "Project not found." };
  }

  const projects = state.projects.filter((p) => p.id !== projectId);
  const mails = state.mails.filter((m) => m.projectId !== projectId);

  if (projects.length === 0) {
    return { status: "empty" };
  }

  return { status: "success", projects, mails };
}

/**
 * Pure function to bind a new mail to an existing project.
 * Updates the project's mailCount and updatedAt timestamp.
 */
export function bindMail(
  state: BinderStateSuccess,
  projectId: ProjectId,
  params: BindMailParams,
  deps: CoreDeps,
): BinderStateSuccess | BinderStateError {
  const projectIndex = state.projects.findIndex((p) => p.id === projectId);
  if (projectIndex === -1) {
    return { status: "error", message: "Project not found." };
  }

  const newMail: BinderMail = {
    id: deps.generateId("mail"),
    projectId,
    subject: params.subject.trim(),
    sender: params.sender.trim(),
    date: params.date,
    snippet: params.snippet.trim(),
  };

  const projects = [...state.projects];
  const project = { ...projects[projectIndex] };

  project.mailCount += 1;
  project.updatedAt = deps.now();
  projects[projectIndex] = project;

  const mails = [...state.mails, newMail];

  return { status: "success", projects, mails };
}

/**
 * Pure function to unbind a mail from its project.
 * Reduces the project's mailCount and updates the updatedAt timestamp.
 */
export function unbindMail(
  state: BinderStateSuccess,
  mailId: MailId,
  deps: CoreDeps,
): BinderStateSuccess | BinderStateError {
  const mail = state.mails.find((m) => m.id === mailId);
  if (!mail) {
    return { status: "error", message: "Mail not found." };
  }

  const projectIndex = state.projects.findIndex((p) => p.id === mail.projectId);
  if (projectIndex === -1) {
    return { status: "error", message: "Project for this mail not found." };
  }

  const mails = state.mails.filter((m) => m.id !== mailId);

  const projects = [...state.projects];
  const project = { ...projects[projectIndex] };
  project.mailCount = Math.max(0, project.mailCount - 1);
  project.updatedAt = deps.now();
  projects[projectIndex] = project;

  return { status: "success", projects, mails };
}
