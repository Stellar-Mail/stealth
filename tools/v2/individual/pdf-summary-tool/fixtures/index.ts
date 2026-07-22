/**
 * PDF Summary Tool — Fixtures Barrel Export
 *
 * Re-exports types, service, and fixture data from this module.
 */

// Types & enums
export {
  FixtureAction,
  FixtureErrorCode,
} from "./execution.types";
export type {
  FixtureExecutionInput,
  FixtureExecutionOutput,
  FixtureExecutionError,
  GenerateSummaryPayload,
  ValidatePdfPayload,
} from "./execution.types";

// Service
export { FixtureExecutionService } from "./execution.service";

// Fixture data
export {
  SUCCESS_FIXTURES,
  FAILURE_FIXTURES,
} from "./execution.fixtures";
export type { ExecutionFixture } from "./execution.fixtures";
