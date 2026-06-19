/**
 * draft.service.mjs — Shared Draft Collaboration
 *
 * Pure service factory. No network calls, no secrets.
 * State is held in memory and seeded from local fixtures.
 *
 * Operations:
 *   getDrafts(filter?)    → SharedDraftData[]
 *   addDraft(input)       → SharedDraftData   (auto id + timestamp)
 *   updateDraft(input)    → SharedDraftData   (throws if not found)
 *   removeDraft(id)       → void              (throws if not found)
 *   setActive(id)         → SharedDraftData   (throws if not found)
 *   getMetrics()          → DraftMetrics
 */

import { DRAFT_FIXTURES } from "../fixtures/drafts.fixtures.mjs";

let _counter = 100;
function generateId() {
  return `draft-${String(++_counter).padStart(3, "0")}`;
}

function now() {
  return new Date().toISOString();
}

export function computeMetrics(drafts) {
  return {
    total: drafts.length,
    active: drafts.filter((d) => d.isActive).length,
    inactive: drafts.filter((d) => !d.isActive).length,
    totalCollaborators: drafts.reduce((sum, d) => sum + d.collaborators, 0),
  };
}

export function applyFilter(drafts, filter = {}) {
  let result = drafts;
  if (filter.isActive !== undefined) result = result.filter((d) => d.isActive === filter.isActive);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    result = result.filter(
      (d) =>
        d.title.toLowerCase().includes(q) || (d.subject && d.subject.toLowerCase().includes(q)),
    );
  }
  return result;
}

export function createDraftService(initialDrafts = DRAFT_FIXTURES) {
  let drafts = initialDrafts.map((d) => ({ ...d }));

  async function getDrafts(filter = {}) {
    return applyFilter(drafts, filter);
  }

  async function addDraft(input) {
    const draft = {
      id: generateId(),
      title: input.title,
      subject: input.subject ?? "",
      lastModified: now(),
      collaborators: input.collaborators ?? 1,
      isActive: false,
    };
    drafts = [...drafts, draft];
    return draft;
  }

  async function updateDraft(input) {
    const idx = drafts.findIndex((d) => d.id === input.id);
    if (idx === -1) throw new Error(`Draft ${input.id} not found.`);
    const updated = { ...drafts[idx], ...input, lastModified: now() };
    drafts = drafts.map((d, i) => (i === idx ? updated : d));
    return updated;
  }

  async function removeDraft(id) {
    const idx = drafts.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error(`Draft ${id} not found.`);
    drafts = drafts.filter((d) => d.id !== id);
  }

  async function setActive(id) {
    const idx = drafts.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error(`Draft ${id} not found.`);
    const updated = { ...drafts[idx], isActive: true, lastModified: now() };
    drafts = drafts.map((d, i) => (i === idx ? updated : d));
    return updated;
  }

  async function getMetrics() {
    return computeMetrics(drafts);
  }

  return { getDrafts, addDraft, updateDraft, removeDraft, setActive, getMetrics };
}
