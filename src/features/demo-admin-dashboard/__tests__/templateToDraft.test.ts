import { describe, expect, it } from "vitest";
import type { Draft } from "../types/draft";
import { messageTemplates } from "../templates/messageTemplates";
import {
  draftIdForTemplate,
  insertTemplate,
  isTemplateInserted,
  removeDraft,
  templateToDraft,
} from "../templates/templateToDraft";

const template = messageTemplates[0];

describe("templateToDraft", () => {
  it("maps template fields into the draft shape deterministically", () => {
    const draft = templateToDraft(template);
    expect(draft).toEqual<Draft>({
      id: draftIdForTemplate(template),
      subject: template.subject,
      body: template.body,
      recipients: [...template.recipients],
    });
    // Stable across calls — no clock/random input.
    expect(templateToDraft(template)).toEqual(draft);
  });

  it("does not share the recipients array reference with the template", () => {
    const draft = templateToDraft(template);
    expect(draft.recipients).not.toBe(template.recipients);
  });
});

describe("insertTemplate", () => {
  it("inserts a draft without mutating the input dataset", () => {
    const dataset: Draft[] = [];
    const result = insertTemplate(dataset, template);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dataset).toHaveLength(1);
      expect(isTemplateInserted(result.dataset, template)).toBe(true);
    }
    expect(dataset).toHaveLength(0);
  });

  it("rejects duplicate inserts with a reason", () => {
    const first = insertTemplate([], template);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = insertTemplate(first.dataset, template);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toMatch(/already/i);
  });
});

describe("removeDraft", () => {
  it("removes by id without mutating the input", () => {
    const inserted = insertTemplate([], template);
    if (!inserted.ok) throw new Error("expected insert");
    const next = removeDraft(inserted.dataset, draftIdForTemplate(template));
    expect(next).toHaveLength(0);
    expect(inserted.dataset).toHaveLength(1);
  });
});
