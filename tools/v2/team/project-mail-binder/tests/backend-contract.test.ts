import { describe, it, expect } from "vitest";
import { ProjectMailBinderBackendService } from "../services/binderBackendService";
import {
  validCreateProjectInputFixture,
  validBindMailInputFixture,
  validAutoBindInputFixture,
  invalidCreateInputEmptyNameFixture,
  notFoundProjectIdFixture,
  notFoundMailIdFixture,
  duplicateProjectInputFixture,
  emptyState,
  errorState,
} from "../fixtures/projects";

describe("ProjectMailBinderBackendService Execution Contract", () => {
  const createService = (initialState?: any) =>
    new ProjectMailBinderBackendService(initialState, {
      generateId: (prefix) => `${prefix}-contract-test`,
      now: () => "2026-06-25T12:00:00.000Z",
    });

  it("getState returns current binder state cleanly", async () => {
    const service = createService();
    const result = await service.getState();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("success");
    }
  });

  describe("createProject contract", () => {
    it("creates a project with valid input", async () => {
      const service = createService();
      const result = await service.createProject(validCreateProjectInputFixture);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project.name).toBe(validCreateProjectInputFixture.name);
        expect(result.data.project.color).toBe(validCreateProjectInputFixture.color);
        expect(result.data.state.status).toBe("success");
      }
    });

    it("returns INVALID_INPUT error code on empty name", async () => {
      const service = createService();
      const result = await service.createProject(invalidCreateInputEmptyNameFixture);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT");
        expect(result.error.message).toContain("name is required");
      }
    });

    it("returns DUPLICATE_PROJECT error code on existing project name", async () => {
      const service = createService();
      const result = await service.createProject(duplicateProjectInputFixture);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("DUPLICATE_PROJECT");
        expect(result.error.details?.name).toBe(duplicateProjectInputFixture.name);
      }
    });

    it("returns INVALID_STATE error code when state is in error", async () => {
      const service = createService(errorState("System corrupted"));
      const result = await service.createProject(validCreateProjectInputFixture);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_STATE");
      }
    });
  });

  describe("deleteProject contract", () => {
    it("deletes project successfully", async () => {
      const service = createService();
      const result = await service.deleteProject({
        projectId: "proj-onboarding",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deletedProjectId).toBe("proj-onboarding");
        expect(result.data.removedMailCount).toBeGreaterThan(0);
      }
    });

    it("returns PROJECT_NOT_FOUND error code on non-existent project", async () => {
      const service = createService();
      const result = await service.deleteProject(notFoundProjectIdFixture);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("PROJECT_NOT_FOUND");
      }
    });

    it("returns INVALID_INPUT error code on missing projectId", async () => {
      const service = createService();
      const result = await service.deleteProject({ projectId: "" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT");
      }
    });
  });

  describe("bindMail contract", () => {
    it("binds mail to project successfully", async () => {
      const service = createService();
      const result = await service.bindMail(validBindMailInputFixture);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mail.subject).toBe(validBindMailInputFixture.subject);
        expect(result.data.mail.projectId).toBe(validBindMailInputFixture.projectId);
      }
    });

    it("returns PROJECT_NOT_FOUND error code if project does not exist", async () => {
      const service = createService();
      const result = await service.bindMail({
        ...validBindMailInputFixture,
        projectId: "non-existent-proj",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("PROJECT_NOT_FOUND");
      }
    });

    it("returns INVALID_INPUT error code when subject is missing", async () => {
      const service = createService();
      const result = await service.bindMail({
        projectId: "proj-onboarding",
        subject: "   ",
        sender: "test@example.com",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT");
      }
    });
  });

  describe("unbindMail contract", () => {
    it("unbinds mail successfully", async () => {
      const service = createService();
      const result = await service.unbindMail({ mailId: "mail-001" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.unboundMailId).toBe("mail-001");
      }
    });

    it("returns MAIL_NOT_FOUND error code on non-existent mailId", async () => {
      const service = createService();
      const result = await service.unbindMail(notFoundMailIdFixture);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("MAIL_NOT_FOUND");
      }
    });
  });

  describe("autoBindMails contract", () => {
    it("runs auto binding rules on provided emails", async () => {
      const service = createService();
      const result = await service.autoBindMails(validAutoBindInputFixture);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.boundEmailCount).toBe("number");
      }
    });

    it("returns INVALID_INPUT on non-array input", async () => {
      const service = createService();
      const result = await service.autoBindMails({ emails: null as any });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT");
      }
    });
  });
});
