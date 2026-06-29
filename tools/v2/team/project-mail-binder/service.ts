import type { BinderState, ProjectId, MailId } from "./types";
import { createProject, deleteProject, bindMail, unbindMail } from "./core";
import type { CreateProjectParams, BindMailParams, CoreDeps } from "./core";
import { seedProjects, seedMails } from "./fixtures/projects";

/**
 * Service to simulate async backend integration for the UI.
 * Wraps the pure logic functions from `core.ts` with an in-memory store.
 * Returns fully resolved states (loading, success, error) to drive UI predictably.
 */
export class LocalBinderService {
  private state: BinderState;
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
  }

  /**
   * Retrieves the current state of the binder, simulating network delay.
   */
  async getState(): Promise<BinderState> {
    await this.simulateDelay();
    return this.state;
  }

  /**
   * Creates a new project binder.
   */
  async createProject(params: CreateProjectParams): Promise<BinderState> {
    await this.simulateDelay();
    if (this.state.status !== "success" && this.state.status !== "empty") {
      return {
        status: "error",
        message: "Invalid state for creating project. Must be success or empty.",
      };
    }
    this.state = createProject(this.state, params, this.deps);
    return this.state;
  }

  /**
   * Deletes a project binder and unbinds all its associated mail.
   */
  async deleteProject(projectId: ProjectId): Promise<BinderState> {
    await this.simulateDelay();
    if (this.state.status !== "success") {
      return {
        status: "error",
        message: "Invalid state for deleting project. Must be success.",
      };
    }
    this.state = deleteProject(this.state, projectId);
    return this.state;
  }

  /**
   * Binds a mail to an existing project.
   */
  async bindMail(projectId: ProjectId, params: BindMailParams): Promise<BinderState> {
    await this.simulateDelay();
    if (this.state.status !== "success") {
      return {
        status: "error",
        message: "Invalid state for binding mail. Must be success.",
      };
    }
    this.state = bindMail(this.state, projectId, params, this.deps);
    return this.state;
  }

  /**
   * Unbinds a mail from its project.
   */
  async unbindMail(mailId: MailId): Promise<BinderState> {
    await this.simulateDelay();
    if (this.state.status !== "success") {
      return {
        status: "error",
        message: "Invalid state for unbinding mail. Must be success.",
      };
    }
    this.state = unbindMail(this.state, mailId, this.deps);
    return this.state;
  }

  /**
   * Used locally to artificially delay simulated network operations.
   */
  private async simulateDelay(): Promise<void> {
    // A micro-delay to ensure async behaviour, keeping tests fast
    // while forcing consumers to handle Promise boundaries.
    return new Promise((resolve) => setTimeout(resolve, 5));
  }
}
