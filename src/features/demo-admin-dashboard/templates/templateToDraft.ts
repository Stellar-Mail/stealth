import type { Draft } from "../types/draft";
import type { MessageTemplate } from "./types";

/** Deterministic draft id derived from a template id (no clock/random input). */
export function draftIdForTemplate(template: MessageTemplate): string {
  return `draft-${template.id}`;
}

/**
 * Convert a template into a `Draft` shaped like the existing draft dataset, so
 * inserted templates can flow into the demo inbox without reshaping later.
 */
export function templateToDraft(template: MessageTemplate): Draft {
  return {
    id: draftIdForTemplate(template),
    subject: template.subject,
    body: template.body,
    recipients: [...template.recipients],
  };
}

/** Whether a template has already been inserted into the dataset. */
export function isTemplateInserted(dataset: Draft[], template: MessageTemplate): boolean {
  const id = draftIdForTemplate(template);
  return dataset.some((draft) => draft.id === id);
}

export type InsertResult =
  | { ok: true; dataset: Draft[]; draft: Draft }
  | { ok: false; reason: string };

/**
 * Insert a template-derived draft into the dataset. Validates against duplicate
 * inserts so the dataset stays clean; never mutates the input array.
 */
export function insertTemplate(dataset: Draft[], template: MessageTemplate): InsertResult {
  if (isTemplateInserted(dataset, template)) {
    return { ok: false, reason: "This template is already in the draft dataset." };
  }
  const draft = templateToDraft(template);
  return { ok: true, dataset: [...dataset, draft], draft };
}

/** Remove a previously inserted draft by id; never mutates the input array. */
export function removeDraft(dataset: Draft[], draftId: string): Draft[] {
  return dataset.filter((draft) => draft.id !== draftId);
}
