import { describe, expect, it, vi } from "vitest";
import {
  approvalChainBuilderService,
  createApprovalChainBuilderService,
} from "../services/execution.service";
import {
  duplicateApproverInput,
  duplicateStageIdInput,
  failingRepository,
  invalidThresholdInput,
  missingStagesInput,
  successfulChainInput,
} from "../fixtures/execution.fixtures";
import type { ApprovalChain } from "../types/contract";

function deterministicService(repository?: { save: (chain: ApprovalChain) => Promise<void> }) {
  let sequence = 0;
  return createApprovalChainBuilderService({
    generateId: () => `generated-${++sequence}`,
    now: () => new Date("2026-07-18T10:00:00.000Z"),
    repository,
  });
}

describe("approval chain builder execution contract", () => {
  it("builds an ordered, normalized chain", async () => {
    const result = await deterministicService().execute(successfulChainInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      id: "generated-1",
      subjectId: "invoice-1042",
      status: "draft",
      createdAt: "2026-07-18T10:00:00.000Z",
      correlationId: "request-88",
    });
    expect(result.data.stages).toEqual([
      {
        id: "manager-review",
        name: "Manager review",
        approverIds: ["manager-1", "manager-2"],
        requiredApprovals: 1,
        order: 0,
      },
      {
        id: "finance-review",
        name: "Finance review",
        approverIds: ["finance-1"],
        requiredApprovals: 1,
        order: 1,
      },
    ]);
  });

  it("generates ids for stages that omit them", async () => {
    const result = await deterministicService().execute({
      ...successfulChainInput,
      stages: [{ name: "Legal review", approverIds: ["legal-1"] }],
    });

    expect(result.ok && result.data.stages[0].id).toBe("generated-1");
    expect(result.ok && result.data.id).toBe("generated-2");
  });

  it.each([
    [missingStagesInput, "INVALID_INPUT", "stages"],
    [duplicateApproverInput, "DUPLICATE_APPROVER", "stages.0.approverIds.1"],
    [invalidThresholdInput, "INVALID_APPROVAL_THRESHOLD", "stages.0.requiredApprovals"],
    [duplicateStageIdInput, "DUPLICATE_STAGE_ID", "stages.1.id"],
  ] as const)("returns a typed failure for invalid fixtures", async (input, code, field) => {
    const result = await deterministicService().execute(input);

    expect(result).toMatchObject({ ok: false, error: { code, field } });
  });

  it("persists through the injected repository after building", async () => {
    const save = vi.fn(async (_chain: ApprovalChain) => undefined);
    const result = await deterministicService({ save }).execute(successfulChainInput);

    expect(result.ok).toBe(true);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0]).toMatchObject({ subjectId: "invoice-1042" });
  });

  it("maps repository errors to PERSISTENCE_FAILED", async () => {
    const result = await createApprovalChainBuilderService({
      repository: failingRepository,
    }).execute(successfulChainInput);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "PERSISTENCE_FAILED" },
    });
  });

  it("exports a directly callable default non-UI service", async () => {
    const result = await approvalChainBuilderService.execute(successfulChainInput);
    expect(result.ok).toBe(true);
  });
});
