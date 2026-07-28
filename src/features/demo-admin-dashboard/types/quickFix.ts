import type { Draft } from "./draft";
import type { ValidationIssue } from "../validation-types";

/** The kinds of safe, one-click fixes the framework can apply. */
export type QuickFixKind =
  "fill-subject" | "fill-body" | "add-recipient" | "replace-unsafe-recipient";

/**
 * A safe, deterministic repair for a common demo-data validation issue.
 * Each fix returns a new Draft and never mutates its input.
 */
export interface QuickFix {
  kind: QuickFixKind;
  /** Short label for the action button shown in the dashboard. */
  label: string;
  apply(draft: Draft, issue: ValidationIssue): Draft;
}

/** Read-only registry of quick fixes keyed by kind. */
export interface QuickFixRegistry {
  list(): QuickFix[];
  get(kind: QuickFixKind): QuickFix | undefined;
  /** Resolve the fix that matches a validation issue, if any. */
  resolve(issue: ValidationIssue): QuickFix | undefined;
}

/** Outcome of attempting to apply a quick fix to a set of drafts. */
export interface QuickFixApplication {
  applied: boolean;
  drafts: Draft[];
  fix?: QuickFix;
}
