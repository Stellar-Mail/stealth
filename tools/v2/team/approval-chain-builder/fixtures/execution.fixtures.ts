import type { ApprovalChainBuilderInput } from "../types/contract";

export const successfulChainInput: ApprovalChainBuilderInput = {
  subjectId: "invoice-1042",
  subjectType: "invoice",
  name: "High-value invoice approval",
  createdBy: "operations@example.com",
  correlationId: "request-88",
  stages: [
    {
      id: "manager-review",
      name: "Manager review",
      approverIds: ["manager-1", "manager-2"],
      requiredApprovals: 1,
    },
    {
      id: "finance-review",
      name: "Finance review",
      approverIds: ["finance-1"],
    },
  ],
};

export const missingStagesInput: ApprovalChainBuilderInput = {
  ...successfulChainInput,
  stages: [],
};

export const duplicateApproverInput: ApprovalChainBuilderInput = {
  ...successfulChainInput,
  stages: [
    {
      name: "Manager review",
      approverIds: ["manager-1", "manager-1"],
    },
  ],
};

export const invalidThresholdInput: ApprovalChainBuilderInput = {
  ...successfulChainInput,
  stages: [
    {
      name: "Finance review",
      approverIds: ["finance-1"],
      requiredApprovals: 2,
    },
  ],
};

export const duplicateStageIdInput: ApprovalChainBuilderInput = {
  ...successfulChainInput,
  stages: [
    { id: "review", name: "First review", approverIds: ["manager-1"] },
    { id: "review", name: "Second review", approverIds: ["finance-1"] },
  ],
};

export const failingRepository = {
  async save(): Promise<void> {
    throw new Error("Fixture persistence outage");
  },
};
