import { describe, expect, it, vi } from "vitest";
import {
  departmentLabelsService,
  createDepartmentLabelsService,
} from "../services/execution.service";
import {
  duplicateDepartmentInput,
  duplicateLabelIdInput,
  failingRepository,
  invalidColorFormatInput,
  missingCreatedByInput,
  missingDepartmentCodeInput,
  missingLabelNameInput,
  missingLabelsInput,
  successfulLabelsInput,
} from "../fixtures/execution.fixtures";
import type { DepartmentLabels } from "../types/contract";

function deterministicService(repository?: { save: (labels: DepartmentLabels) => Promise<void> }) {
  let sequence = 0;
  return createDepartmentLabelsService({
    generateId: () => `generated-${++sequence}`,
    now: () => new Date("2026-07-19T10:00:00.000Z"),
    repository,
  });
}

describe("department labels execution contract", () => {
  it("builds an ordered, normalized labels set", async () => {
    const result = await deterministicService().execute(successfulLabelsInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      id: "generated-1",
      createdBy: "admin@example.com",
      createdAt: "2026-07-19T10:00:00.000Z",
      correlationId: "request-123",
    });
    expect(result.data.labels).toEqual([
      {
        id: "finance-label",
        name: "Finance",
        departmentCode: "FIN",
        color: "#10B981",
        description: "Finance department for financial operations",
        order: 0,
      },
      {
        id: "engineering-label",
        name: "Engineering",
        departmentCode: "ENG",
        color: "#3B82F6",
        description: "Engineering department for technical development",
        order: 1,
      },
      {
        id: "hr-label",
        name: "Human Resources",
        departmentCode: "HR",
        color: "#F59E0B",
        description: undefined,
        order: 2,
      },
    ]);
  });

  it("generates ids for labels that omit them", async () => {
    const result = await deterministicService().execute({
      ...successfulLabelsInput,
      labels: [{ name: "Finance", departmentCode: "FIN", color: "#10B981" }],
    });

    expect(result.ok && result.data.labels[0].id).toBe("generated-1");
    expect(result.ok && result.data.id).toBe("generated-2");
  });

  it("defaults color to blue when omitted", async () => {
    const result = await deterministicService().execute({
      ...successfulLabelsInput,
      labels: [{ name: "Finance", departmentCode: "FIN" }],
    });

    expect(result.ok && result.data.labels[0].color).toBe("#3B82F6");
  });

  it.each([
    [missingLabelsInput, "INVALID_INPUT", "labels"],
    [missingCreatedByInput, "INVALID_INPUT", "createdBy"],
    [missingLabelNameInput, "INVALID_INPUT", "labels.0.name"],
    [missingDepartmentCodeInput, "INVALID_INPUT", "labels.0.departmentCode"],
    [duplicateLabelIdInput, "DUPLICATE_LABEL_ID", "labels.1.id"],
    [duplicateDepartmentInput, "DUPLICATE_DEPARTMENT", "labels.1.departmentCode"],
    [invalidColorFormatInput, "INVALID_COLOR_FORMAT", "labels.0.color"],
  ] as const)("returns a typed failure for invalid fixtures", async (input, code, field) => {
    const result = await deterministicService().execute(input);

    expect(result).toMatchObject({ ok: false, error: { code, field } });
  });

  it("persists through the injected repository after building", async () => {
    const save = vi.fn(async (_labels: DepartmentLabels) => undefined);
    const result = await deterministicService({ save }).execute(successfulLabelsInput);

    expect(result.ok).toBe(true);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0]).toMatchObject({ createdBy: "admin@example.com" });
  });

  it("maps repository errors to PERSISTENCE_FAILED", async () => {
    const result = await createDepartmentLabelsService({
      repository: failingRepository,
    }).execute(successfulLabelsInput);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "PERSISTENCE_FAILED" },
    });
  });

  it("exports a directly callable default non-UI service", async () => {
    const result = await departmentLabelsService.execute(successfulLabelsInput);
    expect(result.ok).toBe(true);
  });
});
