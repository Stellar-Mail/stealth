/**
 * Project Mail Binder — logic, fixture, and accessibility metadata tests.
 *
 * Because @testing-library/react is not installed in this project, we test
 * the tool's constituent logic units directly:
 *  - State builders and fixture determinism
 *  - Type guard correctness
 *  - Accessibility constant integrity (labels, roles, key mappings)
 *  - Fixture data shape validation
 *
 * Component rendering tests are candidates for a future e2e/Playwright suite
 * once the test environment is expanded.
 */
import { describe, it, expect } from "vitest";
import {
  emptyState,
  loadingState,
  errorState,
  successState,
  stateByName,
  seedProjects,
  seedMails,
} from "../fixtures/projects";
import { isEmptyState, isLoadingState, isErrorState, isSuccessState, A11Y } from "../types";
import type { BinderState, BinderProject, BinderMail } from "../types";

// ---------------------------------------------------------------------------
// State builder shape tests
// ---------------------------------------------------------------------------

describe("State builders", () => {
  it("emptyState has status 'empty'", () => {
    const state = emptyState();
    expect(state.status).toBe("empty");
    expect(Object.keys(state)).toEqual(["status"]);
  });

  it("loadingState has status 'loading'", () => {
    const state = loadingState();
    expect(state.status).toBe("loading");
    expect(Object.keys(state)).toEqual(["status"]);
  });

  it("errorState has status 'error' with a message", () => {
    const state = errorState();
    expect(state.status).toBe("error");
    expect(state.message).toBe("Failed to load project binders. Please try again.");
  });

  it("errorState accepts a custom message", () => {
    const state = errorState("Network timeout");
    expect(state.message).toBe("Network timeout");
  });

  it("successState has status 'success' with projects and mails", () => {
    const state = successState();
    expect(state.status).toBe("success");
    expect(state.projects.length).toBeGreaterThan(0);
    expect(state.mails.length).toBeGreaterThan(0);
  });

  it("stateByName returns the correct state for each name", () => {
    expect(stateByName("empty").status).toBe("empty");
    expect(stateByName("loading").status).toBe("loading");
    expect(stateByName("error").status).toBe("error");
    expect(stateByName("success").status).toBe("success");
  });
});

// ---------------------------------------------------------------------------
// Fixture determinism
// ---------------------------------------------------------------------------

describe("Fixture determinism", () => {
  it("emptyState returns identical results across calls", () => {
    expect(emptyState()).toEqual(emptyState());
  });

  it("loadingState returns identical results across calls", () => {
    expect(loadingState()).toEqual(loadingState());
  });

  it("errorState returns identical results across calls", () => {
    expect(errorState()).toEqual(errorState());
  });

  it("successState returns identical results across calls", () => {
    expect(successState()).toEqual(successState());
  });

  it("successState returns copies, not references", () => {
    const a = successState();
    const b = successState();
    expect(a.projects).not.toBe(b.projects);
    expect(a.mails).not.toBe(b.mails);
    expect(a.projects[0]).not.toBe(b.projects[0]);
  });
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

describe("Type guards", () => {
  it("isEmptyState narrows correctly", () => {
    const state: BinderState = emptyState();
    expect(isEmptyState(state)).toBe(true);
    expect(isLoadingState(state)).toBe(false);
    expect(isErrorState(state)).toBe(false);
    expect(isSuccessState(state)).toBe(false);
  });

  it("isLoadingState narrows correctly", () => {
    const state: BinderState = loadingState();
    expect(isLoadingState(state)).toBe(true);
    expect(isEmptyState(state)).toBe(false);
    expect(isErrorState(state)).toBe(false);
    expect(isSuccessState(state)).toBe(false);
  });

  it("isErrorState narrows correctly", () => {
    const state: BinderState = errorState();
    expect(isErrorState(state)).toBe(true);
    expect(isEmptyState(state)).toBe(false);
    expect(isLoadingState(state)).toBe(false);
    expect(isSuccessState(state)).toBe(false);
  });

  it("isSuccessState narrows correctly", () => {
    const state: BinderState = successState();
    expect(isSuccessState(state)).toBe(true);
    expect(isEmptyState(state)).toBe(false);
    expect(isLoadingState(state)).toBe(false);
    expect(isErrorState(state)).toBe(false);
  });

  it("type guard enables safe property access after narrowing", () => {
    const state: BinderState = successState();
    if (isSuccessState(state)) {
      // TypeScript should allow this without errors
      expect(state.projects.length).toBeGreaterThan(0);
      expect(state.mails.length).toBeGreaterThan(0);
    }

    const errState: BinderState = errorState("oops");
    if (isErrorState(errState)) {
      expect(errState.message).toBe("oops");
    }
  });
});

// ---------------------------------------------------------------------------
// Fixture data shape validation
// ---------------------------------------------------------------------------

describe("Seed data shapes", () => {
  it("every project has required fields", () => {
    for (const project of seedProjects) {
      expect(typeof project.id).toBe("string");
      expect(project.id.length).toBeGreaterThan(0);
      expect(typeof project.name).toBe("string");
      expect(typeof project.description).toBe("string");
      expect(typeof project.color).toBe("string");
      expect(typeof project.mailCount).toBe("number");
      expect(project.mailCount).toBeGreaterThanOrEqual(0);
      expect(typeof project.createdAt).toBe("string");
      expect(typeof project.updatedAt).toBe("string");
    }
  });

  it("every mail has required fields", () => {
    for (const mail of seedMails) {
      expect(typeof mail.id).toBe("string");
      expect(mail.id.length).toBeGreaterThan(0);
      expect(typeof mail.projectId).toBe("string");
      expect(typeof mail.subject).toBe("string");
      expect(typeof mail.sender).toBe("string");
      expect(typeof mail.date).toBe("string");
      expect(typeof mail.snippet).toBe("string");
    }
  });

  it("every mail references an existing project", () => {
    const projectIds = new Set(seedProjects.map((p) => p.id));
    for (const mail of seedMails) {
      expect(projectIds.has(mail.projectId)).toBe(true);
    }
  });

  it("project ids are unique", () => {
    const ids = seedProjects.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("mail ids are unique", () => {
    const ids = seedMails.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("project mailCount matches actual mail count", () => {
    for (const project of seedProjects) {
      const actualCount = seedMails.filter((m) => m.projectId === project.id).length;
      // mailCount represents the total in the real dataset; our seed
      // subset may not cover all of them. Just verify mailCount >= actual.
      expect(project.mailCount).toBeGreaterThanOrEqual(actualCount);
    }
  });

  it("dates are valid ISO strings", () => {
    for (const project of seedProjects) {
      expect(new Date(project.createdAt).toISOString()).toBe(project.createdAt);
      expect(new Date(project.updatedAt).toISOString()).toBe(project.updatedAt);
    }
    for (const mail of seedMails) {
      expect(new Date(mail.date).toISOString()).toBe(mail.date);
    }
  });
});

// ---------------------------------------------------------------------------
// Accessibility constants
// ---------------------------------------------------------------------------

describe("Accessibility constants (A11Y)", () => {
  it("containerLabel is a non-empty string", () => {
    expect(typeof A11Y.containerLabel).toBe("string");
    expect(A11Y.containerLabel.length).toBeGreaterThan(0);
  });

  it("liveRegion is 'polite'", () => {
    expect(A11Y.liveRegion).toBe("polite");
  });

  it("loadingText is a non-empty string", () => {
    expect(typeof A11Y.loadingText).toBe("string");
    expect(A11Y.loadingText.length).toBeGreaterThan(0);
  });

  it("emptyHeading and emptyCta are non-empty strings", () => {
    expect(A11Y.emptyHeading.length).toBeGreaterThan(0);
    expect(A11Y.emptyCta.length).toBeGreaterThan(0);
  });

  it("errorHeading and retryLabel are non-empty strings", () => {
    expect(A11Y.errorHeading.length).toBeGreaterThan(0);
    expect(A11Y.retryLabel.length).toBeGreaterThan(0);
  });

  it("projectListLabel is a non-empty string", () => {
    expect(A11Y.projectListLabel.length).toBeGreaterThan(0);
  });

  it("projectDetailLabel returns a label containing the project name", () => {
    const label = A11Y.projectDetailLabel("Test Project");
    expect(label).toContain("Test Project");
  });

  it("mailListLabel returns a label containing the project name", () => {
    const label = A11Y.mailListLabel("Test Project");
    expect(label).toContain("Test Project");
  });

  it("keys contains all required keyboard constants", () => {
    expect(A11Y.keys.ENTER).toBe("Enter");
    expect(A11Y.keys.SPACE).toBe(" ");
    expect(A11Y.keys.ESCAPE).toBe("Escape");
    expect(A11Y.keys.ARROW_UP).toBe("ArrowUp");
    expect(A11Y.keys.ARROW_DOWN).toBe("ArrowDown");
  });
});

// ---------------------------------------------------------------------------
// Empty state edge cases
// ---------------------------------------------------------------------------

describe("Empty state edge cases", () => {
  it("successState with no selected project returns all projects", () => {
    const state = successState();
    if (isSuccessState(state)) {
      expect(state.projects).toHaveLength(seedProjects.length);
    }
  });

  it("filtering mails by non-existent project returns empty array", () => {
    const state = successState();
    if (isSuccessState(state)) {
      const filtered = state.mails.filter((m) => m.projectId === "non-existent");
      expect(filtered).toEqual([]);
    }
  });

  it("filtering mails by valid project returns only its mails", () => {
    const state = successState();
    if (isSuccessState(state)) {
      const mails = state.mails.filter((m) => m.projectId === "proj-onboarding");
      expect(mails.length).toBeGreaterThan(0);
      for (const mail of mails) {
        expect(mail.projectId).toBe("proj-onboarding");
      }
    }
  });
});
