import type {
  IBinderBackendService,
  BinderState,
  BinderResult,
  CreateProjectInput,
  CreateProjectOutput,
  DeleteProjectInput,
  DeleteProjectOutput,
  BindMailInput,
  BindMailOutput,
  UnbindMailInput,
  UnbindMailOutput,
  AutoBindInput,
  AutoBindOutput,
  BinderProject,
  BinderMail,
  Project,
} from "../types";
import { createProject, deleteProject, bindMail, unbindMail, CoreDeps } from "../core";
import { ProjectBinderService } from "./projectBinderService";
import { seedProjects, seedMails } from "../fixtures/projects";

/**
 * Non-UI service entry point for Project Mail Binder.
 * Operates independently of presentation concerns, returning strictly typed
 * input/output contracts and structured error codes.
 */
export class ProjectMailBinderBackendService implements IBinderBackendService {
  private state: BinderState;
  private projectBinderService: ProjectBinderService;
  private deps: CoreDeps;

  constructor(initialState?: BinderState, deps?: Partial<CoreDeps>) {
    this.state = initialState ?? {
      status: "success",
      projects: seedProjects.map((p) => ({ ...p })),
      mails: seedMails.map((m) => ({ ...m })),
    };

    this.deps = {
      generateId:
        deps?.generateId ?? ((prefix) => `${prefix}-${Math.random().toString(36).substring(2, 9)}`),
      now: deps?.now ?? (() => new Date().toISOString()),
    };

    const initialRichProjects: Project[] =
      this.state.status === "success"
        ? this.state.projects.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            members: [],
            rules: [],
            createdAt: p.createdAt,
          }))
        : [];

    this.projectBinderService = new ProjectBinderService(initialRichProjects);
  }

  /**
   * Retrieves current binder state.
   */
  async getState(): Promise<BinderResult<BinderState>> {
    return { success: true, data: this.state };
  }

  /**
   * Creates a new project in the binder.
   */
  async createProject(input: CreateProjectInput): Promise<BinderResult<CreateProjectOutput>> {
    if (!input || typeof input.name !== "string" || !input.name.trim()) {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Project name is required and cannot be empty or whitespace.",
          details: { name: input?.name },
        },
      };
    }

    if (this.state.status !== "success" && this.state.status !== "empty") {
      return {
        success: false,
        error: {
          code: "INVALID_STATE",
          message: `Cannot create project in current state: ${this.state.status}.`,
        },
      };
    }

    // Check duplicate
    if (
      this.state.status === "success" &&
      this.state.projects.some((p) => p.name.toLowerCase() === input.name.trim().toLowerCase())
    ) {
      return {
        success: false,
        error: {
          code: "DUPLICATE_PROJECT",
          message: `A project with the name "${input.name.trim()}" already exists.`,
          details: { name: input.name },
        },
      };
    }

    const color = input.color ?? "blue";
    const resultState = createProject(
      this.state,
      {
        name: input.name,
        description: input.description ?? "",
        color,
      },
      this.deps,
    );

    if (resultState.status === "error") {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: resultState.message,
        },
      };
    }

    this.state = resultState;
    const createdProject = resultState.projects[resultState.projects.length - 1];

    // Synchronize to rich project binder service
    try {
      this.projectBinderService.createProject({
        id: createdProject.id,
        name: createdProject.name,
        description: createdProject.description,
        stellarAddress: input.stellarAddress,
        stellarAssetCode: input.stellarAssetCode,
        members: input.members ?? [],
        rules: input.rules ?? [],
        createdAt: createdProject.createdAt,
      });
    } catch {
      // Keep state sync seamless
    }

    return {
      success: true,
      data: {
        project: createdProject,
        state: this.state,
      },
    };
  }

  /**
   * Deletes a project and all associated mails.
   */
  async deleteProject(input: DeleteProjectInput): Promise<BinderResult<DeleteProjectOutput>> {
    if (!input || !input.projectId) {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "projectId is required for project deletion.",
        },
      };
    }

    if (this.state.status !== "success") {
      return {
        success: false,
        error: {
          code: "INVALID_STATE",
          message: `Cannot delete project in current state: ${this.state.status}.`,
        },
      };
    }

    const existingProject = this.state.projects.find((p) => p.id === input.projectId);
    if (!existingProject) {
      return {
        success: false,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: `Project with ID "${input.projectId}" was not found.`,
          details: { projectId: input.projectId },
        },
      };
    }

    const removedMailCount = this.state.mails.filter((m) => m.projectId === input.projectId).length;
    const resultState = deleteProject(this.state, input.projectId);

    if (resultState.status === "error") {
      return {
        success: false,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: resultState.message,
        },
      };
    }

    this.state = resultState;

    return {
      success: true,
      data: {
        deletedProjectId: input.projectId,
        removedMailCount,
        state: this.state,
      },
    };
  }

  /**
   * Binds a mail item to a project.
   */
  async bindMail(input: BindMailInput): Promise<BinderResult<BindMailOutput>> {
    if (!input || !input.projectId || !input.subject?.trim() || !input.sender?.trim()) {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "projectId, subject, and sender are required fields for mail binding.",
          details: { ...input },
        },
      };
    }

    if (this.state.status !== "success") {
      return {
        success: false,
        error: {
          code: "INVALID_STATE",
          message: `Cannot bind mail in current state: ${this.state.status}.`,
        },
      };
    }

    const projectExists = this.state.projects.some((p) => p.id === input.projectId);
    if (!projectExists) {
      return {
        success: false,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: `Target project with ID "${input.projectId}" was not found.`,
          details: { projectId: input.projectId },
        },
      };
    }

    const date = input.date ?? this.deps.now();
    const snippet = input.snippet ?? (input.body ? input.body.substring(0, 100) : input.subject);

    const resultState = bindMail(
      this.state,
      input.projectId,
      {
        subject: input.subject,
        sender: input.sender,
        date,
        snippet,
      },
      this.deps,
    );

    if (resultState.status === "error") {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: resultState.message,
        },
      };
    }

    this.state = resultState;
    const addedMail = resultState.mails[resultState.mails.length - 1];

    try {
      this.projectBinderService.bindEmail(addedMail.id, input.projectId);
    } catch {
      // Sync tolerance
    }

    return {
      success: true,
      data: {
        mail: addedMail,
        state: this.state,
      },
    };
  }

  /**
   * Unbinds a mail item from its project.
   */
  async unbindMail(input: UnbindMailInput): Promise<BinderResult<UnbindMailOutput>> {
    if (!input || !input.mailId) {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "mailId is required for unbinding mail.",
        },
      };
    }

    if (this.state.status !== "success") {
      return {
        success: false,
        error: {
          code: "INVALID_STATE",
          message: `Cannot unbind mail in current state: ${this.state.status}.`,
        },
      };
    }

    const mailExists = this.state.mails.some((m) => m.id === input.mailId);
    if (!mailExists) {
      return {
        success: false,
        error: {
          code: "MAIL_NOT_FOUND",
          message: `Mail with ID "${input.mailId}" was not found.`,
          details: { mailId: input.mailId },
        },
      };
    }

    const resultState = unbindMail(this.state, input.mailId, this.deps);

    if (resultState.status === "error") {
      return {
        success: false,
        error: {
          code: "MAIL_NOT_FOUND",
          message: resultState.message,
        },
      };
    }

    this.state = resultState;

    return {
      success: true,
      data: {
        unboundMailId: input.mailId,
        state: this.state,
      },
    };
  }

  /**
   * Evaluates rules against incoming emails and creates automatic bindings.
   */
  async autoBindMails(input: AutoBindInput): Promise<BinderResult<AutoBindOutput>> {
    if (!input || !Array.isArray(input.emails)) {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "emails array is required for auto-binding.",
        },
      };
    }

    try {
      const emailObjects = input.emails.map((e) => ({
        id: e.id,
        from: e.from,
        email: e.email,
        subject: e.subject,
        preview: e.preview ?? e.subject,
        body: e.body ?? e.subject,
        time: e.time ?? this.deps.now(),
        unread: false,
        starred: false,
        folder: "inbox" as any,
        avatarColor: "#000000",
      }));

      const bindings = this.projectBinderService.autoBindEmails(emailObjects);

      // Also reflect into BinderState if project exists
      if (this.state.status === "success") {
        for (const binding of bindings) {
          const emailObj = input.emails.find((e) => e.id === binding.emailId);
          if (emailObj) {
            this.bindMail({
              projectId: binding.projectId,
              subject: emailObj.subject,
              sender: emailObj.email,
              date: this.deps.now(),
              snippet: emailObj.preview ?? emailObj.subject,
              bindingType: "automatic",
              boundBy: binding.boundBy,
            });
          }
        }
      }

      return {
        success: true,
        data: {
          createdBindings: bindings,
          boundEmailCount: bindings.length,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "RULE_EVALUATION_ERROR",
          message: err?.message ?? "An error occurred during rule evaluation.",
        },
      };
    }
  }
}
