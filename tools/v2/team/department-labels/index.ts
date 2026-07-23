export { departmentLabelsService, createDepartmentLabelsService } from "./services";
export type {
  DepartmentLabelsDependencies,
  DepartmentLabelsService,
  DepartmentLabelsRepository,
} from "./services";
export type {
  DepartmentLabels,
  DepartmentLabelsInput,
  DepartmentLabelsResult,
  DepartmentLabelsError,
  DepartmentLabelsErrorCode,
  DepartmentLabel,
  DepartmentLabelInput,
  ExecuteDepartmentLabels,
} from "./types";
export {
  duplicateDepartmentInput,
  duplicateLabelIdInput,
  failingRepository,
  invalidColorFormatInput,
  missingCreatedByInput,
  missingDepartmentCodeInput,
  missingLabelNameInput,
  missingLabelsInput,
  successfulLabelsInput,
} from "./fixtures/execution.fixtures";
