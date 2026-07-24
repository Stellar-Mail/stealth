import { describe, it, expect } from "vitest";
import {
  createReviewFlag,
  isReviewFlagError,
  type ReviewFlagInput,
} from "../../../tools/v2/team/legal-and-compliance-review-flag/contract";
import { createReviewFlagService } from "../../../tools/v2/team/legal-and-compliance-review-flag/services/review-flag-service";
import {
  authorizedReviewer,
  validInput,
  lowSeverityInput,
  missingReviewerInput,
  missingReasonInput,
  invalidSeverityInput,
  resourceNotFoundInput,
  makeDependency,
} from "../../../tools/v2/team/legal-and-compliance-review-flag/fixtures";

describe("createReviewFlag — valid path", () => {
  it("creates an open, pending flag with an audit trail", async () => {
    const deps = makeDependency();
    const outcome = await createReviewFlag(validInput, deps);

    expect(isReviewFlagError(outcome)).toBe(false);
    if (isReviewFlagError(outcome)) return;

    expect(outcome.status).toBe("open");
    expect(outcome.reviewState).toBe("pending");
    expect(outcome.timestamp).toBe(1_700_000_000_000);
    expect(outcome.flagId).toMatch(/^flag:fixed-/);
    expect(outcome.auditTrail).toContain("flag.created id=" + outcome.flagId);
    expect(deps.persisted).toHaveLength(1);
  });

  it("records evidence count in the audit trail", async () => {
    const deps = makeDependency();
    const outcome = await createReviewFlag(validInput, deps);
    if (isReviewFlagError(outcome)) throw new Error("expected success");
    expect(outcome.auditTrail).toContain("flag.evidence.count=2");
  });

  it("supports low severity without evidence refs", async () => {
    const deps = makeDependency();
    const outcome = await createReviewFlag(lowSeverityInput, deps);
    expect(isReviewFlagError(outcome)).toBe(false);
  });
});

describe("createReviewFlag — invalid input", () => {
  it("rejects an empty reviewer", async () => {
    const outcome = await createReviewFlag(missingReviewerInput, makeDependency());
    expect(outcome).toMatchObject({ code: "invalid_input", fields: ["reviewer"] });
  });

  it("rejects an empty reason", async () => {
    const outcome = await createReviewFlag(missingReasonInput, makeDependency());
    expect(outcome).toMatchObject({ code: "invalid_input", fields: ["flagReason"] });
  });

  it("rejects an unknown severity", async () => {
    const outcome = await createReviewFlag(invalidSeverityInput, makeDependency());
    expect(outcome).toMatchObject({ code: "invalid_input", fields: ["severity"] });
  });
});

describe("createReviewFlag — guard failures", () => {
  it("rejects an unauthorized reviewer", async () => {
    const input: ReviewFlagInput = { ...validInput, reviewer: "reviewer:intern-007" };
    const outcome = await createReviewFlag(input, makeDependency({ authorized: false }));
    expect(outcome).toMatchObject({ code: "unauthorized_reviewer" });
  });

  it("rejects a missing resource", async () => {
    const outcome = await createReviewFlag(resourceNotFoundInput, makeDependency());
    expect(outcome).toMatchObject({ code: "resource_not_found" });
  });

  it("rejects a duplicate open flag", async () => {
    const outcome = await createReviewFlag(
      validInput,
      makeDependency({ existingFlagId: "flag:existing-1" }),
    );
    expect(outcome).toMatchObject({
      code: "duplicate_flag",
      existingFlagId: "flag:existing-1",
    });
  });

  it("does not persist on any failure", async () => {
    const deps = makeDependency({ existingFlagId: "flag:existing-1" });
    const outcome = await createReviewFlag(validInput, deps);
    expect(outcome).toMatchObject({ code: "duplicate_flag" });
    expect(deps.persisted).toHaveLength(0);
  });
});

describe("review-flag-service boundary", () => {
  it("wires the backend and returns the contract outcome", async () => {
    const saved: Array<{ input: ReviewFlagInput; id: string }> = [];
    const service = createReviewFlagService({
      isAuthorizedReviewer: async (r) => r === authorizedReviewer,
      resourceExists: async () => true,
      findOpenFlag: async () => null,
      saveFlag: async (input, flagId) => {
        saved.push({ input, id: flagId });
      },
      now: () => 1_700_000_000_000,
      newId: () => "flag:svc-1",
    });

    const outcome = await service.raiseFlag(validInput);
    expect(isReviewFlagError(outcome)).toBe(false);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe("flag:svc-1");
  });

  it("propagates the contract error through the service", async () => {
    const service = createReviewFlagService({
      isAuthorizedReviewer: async () => false,
      resourceExists: async () => true,
      findOpenFlag: async () => null,
      saveFlag: async () => {},
      now: () => 0,
      newId: () => "flag:x",
    });
    const outcome = await service.raiseFlag(validInput);
    expect(outcome).toMatchObject({ code: "unauthorized_reviewer" });
  });
});
