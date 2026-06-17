import type { ValidationIssue } from "./validation-types";

/**
 * Deterministic, fake validation issues for the demo admin dashboard.
 * Safe for public review: no real user data, secrets, or network calls.
 */
export const demoValidationIssues: ValidationIssue[] = [
  {
    id: "v-001",
    severity: "error",
    fieldPath: "records[0].email",
    message: "Email address is missing the domain.",
    datasetId: "demo-contacts",
    recordId: "rec-0",
    hint: "Use a full address like name@example.com.",
  },
  {
    id: "v-002",
    severity: "error",
    fieldPath: "records[2].postageAmount",
    message: "Postage amount must be a positive number.",
    datasetId: "demo-contacts",
    recordId: "rec-2",
    hint: "Enter an amount greater than 0.",
  },
  {
    id: "v-003",
    severity: "warning",
    fieldPath: "records[1].labels",
    message: "Unknown label will be ignored on import.",
    datasetId: "demo-contacts",
    recordId: "rec-1",
    hint: "Pick a label from the existing set.",
  },
  {
    id: "v-004",
    severity: "warning",
    fieldPath: "records[4].avatarColor",
    message: "Avatar color is not a recognized token.",
    datasetId: "demo-contacts",
    recordId: "rec-4",
  },
  {
    id: "v-005",
    severity: "info",
    fieldPath: "meta.generatedAt",
    message: "Dataset was generated more than 7 days ago.",
    datasetId: "demo-contacts",
    hint: "Regenerate to refresh the preview.",
  },
];

/** A clean dataset (no issues) for demoing the empty state. */
export const demoValidationIssuesEmpty: ValidationIssue[] = [];
