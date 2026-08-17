/**
 * tests/index.ts — Non-UI execution contract and test fixtures entry point
 *
 * Exports the typed DTOs, error codes, service factory, and success/failure
 * fixtures for testing and headless execution of the team digest generator.
 */

export {
  createTestDigestExecutionService,
  TestDigestExecutionService,
  TestDigestErrorCode,
  ok,
  fail,
} from "./execution-contract";

export type {
  ITestDigestExecutionService,
  TestDigestOperation,
  TestDigestOutput,
  TestDigestResult,
} from "./execution-contract";

export {
  VALID_ITEMS_FIXTURE,
  VALID_ACTIVITY_FIXTURE,
  VALID_EMAIL_FIXTURE,
  VALID_SANITIZE_FIXTURE,
  INVALID_ITEMS_MISSING_AUTHOR,
  INVALID_ACTIVITY_NOT_ARRAY,
  INVALID_EMAIL_FIXTURE,
  INVALID_OPERATION_FIXTURE,
} from "./execution-contract.fixtures";
