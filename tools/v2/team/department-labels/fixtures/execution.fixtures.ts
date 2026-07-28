import type { DepartmentLabelsInput } from "../types/contract";

export const successfulLabelsInput: DepartmentLabelsInput = {
  createdBy: "admin@example.com",
  correlationId: "request-123",
  labels: [
    {
      id: "finance-label",
      name: "Finance",
      departmentCode: "FIN",
      color: "#10B981",
      description: "Finance department for financial operations",
    },
    {
      id: "engineering-label",
      name: "Engineering",
      departmentCode: "ENG",
      color: "#3B82F6",
      description: "Engineering department for technical development",
    },
    {
      id: "hr-label",
      name: "Human Resources",
      departmentCode: "HR",
      color: "#F59E0B",
    },
  ],
};

export const missingLabelsInput: DepartmentLabelsInput = {
  ...successfulLabelsInput,
  labels: [],
};

export const duplicateLabelIdInput: DepartmentLabelsInput = {
  ...successfulLabelsInput,
  labels: [
    {
      id: "duplicate-id",
      name: "Finance",
      departmentCode: "FIN",
      color: "#10B981",
    },
    {
      id: "duplicate-id",
      name: "Engineering",
      departmentCode: "ENG",
      color: "#3B82F6",
    },
  ],
};

export const duplicateDepartmentInput: DepartmentLabelsInput = {
  ...successfulLabelsInput,
  labels: [
    {
      name: "Finance",
      departmentCode: "FIN",
      color: "#10B981",
    },
    {
      name: "Financial Planning",
      departmentCode: "FIN",
      color: "#3B82F6",
    },
  ],
};

export const invalidColorFormatInput: DepartmentLabelsInput = {
  ...successfulLabelsInput,
  labels: [
    {
      name: "Finance",
      departmentCode: "FIN",
      color: "invalid-color",
    },
  ],
};

export const missingCreatedByInput: DepartmentLabelsInput = {
  ...successfulLabelsInput,
  createdBy: "",
};

export const missingLabelNameInput: DepartmentLabelsInput = {
  ...successfulLabelsInput,
  labels: [
    {
      name: "",
      departmentCode: "FIN",
      color: "#10B981",
    },
  ],
};

export const missingDepartmentCodeInput: DepartmentLabelsInput = {
  ...successfulLabelsInput,
  labels: [
    {
      name: "Finance",
      departmentCode: "",
      color: "#10B981",
    },
  ],
};

export const failingRepository = {
  async save(): Promise<void> {
    throw new Error("Fixture persistence outage");
  },
};
