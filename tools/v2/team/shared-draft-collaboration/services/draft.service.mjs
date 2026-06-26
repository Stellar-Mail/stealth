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
import {
  validateDraftId,
  validateDraftTitle,
  validateDraftSubject,
  validateCollaboratorCount,
  validateSearchQuery,
  guardDraftsCount,
  validateDraftInput,
} from "../guards/draft-guards.mjs";

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
  if (filter.isActive !== undefined) {
    result = result.filter((d) => d.isActive === filter.isActive);
  }
  if (filter.search !== undefined && filter.search !== null) {
    const cleanQuery = validateSearchQuery(filter.search);
    if (cleanQuery) {
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(cleanQuery) ||
          (d.subject && d.subject.toLowerCase().includes(cleanQuery)),
      );
    }
  }
  return result;
}

export function createDraftService(initialDrafts = DRAFT_FIXTURES) {
  let drafts = initialDrafts.map((d) => ({ ...d }));

  async function getDrafts(filter = {}) {
    return applyFilter(drafts, filter);
  }

  async function addDraft(input) {
    // 1. Guard drafts collection size
    guardDraftsCount(drafts);

    // 2. Validate and sanitize input fields
    const cleanInput = validateDraftInput(input);

    const draft = {
      id: generateId(),
      title: cleanInput.title,
      subject: cleanInput.subject,
      lastModified: now(),
      collaborators: cleanInput.collaborators,
      isActive: false,
    };
    drafts = [...drafts, draft];
    return draft;
  }

  async function updateDraft(input) {
    if (!input || typeof input !== "object") {
      throw new Error("Update payload must be an object");
    }

    const cleanId = validateDraftId(input.id);

    const idx = drafts.findIndex((d) => d.id === cleanId);
    if (idx === -1) throw new Error(`Draft ${cleanId} not found.`);

    const current = drafts[idx];

    // Validate updates if provided
    const title = input.title !== undefined ? validateDraftTitle(input.title) : current.title;
    const subject =
      input.subject !== undefined ? validateDraftSubject(input.subject) : current.subject;
    const collaborators =
      input.collaborators !== undefined
        ? validateCollaboratorCount(input.collaborators)
        : current.collaborators;

    const updated = {
      ...current,
      title,
      subject,
      collaborators,
      lastModified: now(),
    };

    drafts = drafts.map((d, i) => (i === idx ? updated : d));
    return updated;
  }

  async function removeDraft(id) {
    const cleanId = validateDraftId(id);
    const idx = drafts.findIndex((d) => d.id === cleanId);
    if (idx === -1) throw new Error(`Draft ${cleanId} not found.`);
    drafts = drafts.filter((d) => d.id !== cleanId);
  }

  async function setActive(id) {
    const cleanId = validateDraftId(id);
    const idx = drafts.findIndex((d) => d.id === cleanId);
    if (idx === -1) throw new Error(`Draft ${cleanId} not found.`);
    const updated = { ...drafts[idx], isActive: true, lastModified: now() };
    drafts = drafts.map((d, i) => (i === idx ? updated : d));
    return updated;
  }

  async function getMetrics() {
    return computeMetrics(drafts);
  }

  return { getDrafts, addDraft, updateDraft, removeDraft, setActive, getMetrics };
}
