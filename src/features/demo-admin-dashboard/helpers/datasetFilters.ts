import type { Draft, DraftFilters } from "../types/draft";
import type { Persona, PersonaFilters } from "../types/persona";

/**
 * Helper functions for dataset search and filtering.
 *
 * These utilities are intentionally isolated under the demo admin dashboard
 * feature and only operate on deterministic fake data.
 */

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim();
}

function containsText(value: string, query: string): boolean {
  return normalizeQuery(value).includes(normalizeQuery(query));
}

function isEmptyOrWhitespace(value?: string): boolean {
  return !value || value.trim() === "";
}

export function scoreDraftMatch(draft: Draft, query: string): number {
  if (isEmptyOrWhitespace(query)) {
    return 0;
  }

  const normalizedQuery = normalizeQuery(query);
  let score = 0;

  if (draft.subject.toLowerCase() === normalizedQuery) {
    score += 100;
  } else if (containsText(draft.subject, query)) {
    score += 50;
  }

  if (containsText(draft.body, query)) {
    score += 25;
  }

  const matchingRecipients = draft.recipients.filter((recipient) => containsText(recipient, query));
  score += matchingRecipients.length * 15;

  return score;
}

export function searchDrafts(drafts: Draft[], query: string): Draft[] {
  if (isEmptyOrWhitespace(query)) {
    return drafts;
  }

  return drafts
    .map((draft) => ({ draft, score: scoreDraftMatch(draft, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.draft);
}

export function filterDrafts(drafts: Draft[], filters: DraftFilters): Draft[] {
  let result = drafts;

  if (filters.subject) {
    result = result.filter((draft) => containsText(draft.subject, filters.subject!));
  }

  if (filters.body) {
    result = result.filter((draft) => containsText(draft.body, filters.body!));
  }

  if (filters.recipient) {
    result = result.filter((draft) =>
      draft.recipients.some(
        (recipient) => normalizeQuery(recipient) === normalizeQuery(filters.recipient!),
      ),
    );
  }

  if (filters.searchQuery) {
    result = searchDrafts(result, filters.searchQuery);
  }

  return result;
}

export function scorePersonaMatch(persona: Persona, query: string): number {
  if (isEmptyOrWhitespace(query)) {
    return 0;
  }

  const normalizedQuery = normalizeQuery(query);
  let score = 0;

  if (persona.name.toLowerCase() === normalizedQuery) {
    score += 100;
  } else if (containsText(persona.name, query)) {
    score += 50;
  }

  if (containsText(persona.email, query)) {
    score += 25;
  }

  if (containsText(persona.stellarAddress, query)) {
    score += 15;
  }

  return score;
}

export function searchPersonas(personas: Persona[], query: string): Persona[] {
  if (isEmptyOrWhitespace(query)) {
    return personas;
  }

  return personas
    .map((persona) => ({ persona, score: scorePersonaMatch(persona, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.persona);
}

export function filterPersonas(personas: Persona[], filters: PersonaFilters): Persona[] {
  let result = personas;

  if (filters.name) {
    result = result.filter((persona) => containsText(persona.name, filters.name!));
  }

  if (filters.email) {
    result = result.filter(
      (persona) => normalizeQuery(persona.email) === normalizeQuery(filters.email!),
    );
  }

  if (filters.stellarAddress) {
    result = result.filter(
      (persona) =>
        normalizeQuery(persona.stellarAddress) === normalizeQuery(filters.stellarAddress!),
    );
  }

  if (filters.searchQuery) {
    result = searchPersonas(result, filters.searchQuery);
  }

  return result;
}
