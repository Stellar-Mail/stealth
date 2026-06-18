import { describe, expect, it } from "vitest";
import {
  scoreDraftMatch,
  searchDrafts,
  filterDrafts,
  scorePersonaMatch,
  searchPersonas,
  filterPersonas,
} from "../helpers/datasetFilters";
import type { Draft, DraftFilters } from "../types/draft";
import type { Persona, PersonaFilters } from "../types/persona";

const testDrafts: Draft[] = [
  {
    id: "draft-001",
    subject: "Welcome to the demo",
    body: "This draft explains the new enrollment flow.",
    recipients: ["alice@example.com", "bob@example.com"],
  },
  {
    id: "draft-002",
    subject: "Postage request follow-up",
    body: "Please approve the sender request and refund postage if needed.",
    recipients: ["carol@example.com"],
  },
  {
    id: "draft-003",
    subject: "Draft copy",
    body: "A simple note for the admin dashboard.",
    recipients: ["admin@demo.org"],
  },
];

const testPersonas: Persona[] = [
  {
    id: "pers-001",
    name: "Ava Morgan",
    email: "ava@demo.org",
    stellarAddress: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOP",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=ava",
  },
  {
    id: "pers-002",
    name: "Liam Chen",
    email: "liam@demo.org",
    stellarAddress: "GHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUV",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=liam",
  },
  {
    id: "pers-003",
    name: "Sophia Rodriguez",
    email: "sophia@demo.org",
    stellarAddress: "G1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=sophia",
  },
];

describe("datasetFilters", () => {
  describe("Draft helpers", () => {
    it("should return 0 score for empty draft query", () => {
      expect(scoreDraftMatch(testDrafts[0], "")).toBe(0);
    });

    it("should score exact subject match highest", () => {
      expect(scoreDraftMatch(testDrafts[0], "Welcome to the demo")).toBeGreaterThanOrEqual(100);
    });

    it("should score recipient matches", () => {
      const score = scoreDraftMatch(testDrafts[0], "alice@example.com");
      expect(score).toBeGreaterThan(0);
    });

    it("should return all drafts for empty search query", () => {
      expect(searchDrafts(testDrafts, "")).toEqual(testDrafts);
    });

    it("should search drafts by body content and sort by relevance", () => {
      const result = searchDrafts(testDrafts, "sender request");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("draft-002");
    });

    it("should filter drafts by recipient", () => {
      const filters: DraftFilters = { recipient: "carol@example.com" };
      const result = filterDrafts(testDrafts, filters);
      expect(result).toEqual([testDrafts[1]]);
    });

    it("should filter drafts by subject substring", () => {
      const filters: DraftFilters = { subject: "postage" };
      const result = filterDrafts(testDrafts, filters);
      expect(result.map((draft) => draft.id)).toEqual(["draft-002"]);
    });

    it("should filter drafts by body substring and query together", () => {
      const filters: DraftFilters = {
        body: "admin dashboard",
        searchQuery: "simple note",
      };
      const result = filterDrafts(testDrafts, filters);
      expect(result.map((draft) => draft.id)).toEqual(["draft-003"]);
    });

    it("should return an empty array when draft filters do not match", () => {
      const filters: DraftFilters = { recipient: "nobody@demo.org" };
      expect(filterDrafts(testDrafts, filters)).toEqual([]);
    });
  });

  describe("Persona helpers", () => {
    it("should return 0 score for empty persona query", () => {
      expect(scorePersonaMatch(testPersonas[0], "")).toBe(0);
    });

    it("should score exact name matches", () => {
      expect(scorePersonaMatch(testPersonas[0], "Ava Morgan")).toBeGreaterThanOrEqual(100);
    });

    it("should search personas by email substring", () => {
      const result = searchPersonas(testPersonas, "liam@demo.org");
      expect(result.map((persona) => persona.id)).toEqual(["pers-002"]);
    });

    it("should search personas case-insensitively", () => {
      const lower = searchPersonas(testPersonas, "sophia");
      const upper = searchPersonas(testPersonas, "SOPHIA");
      expect(lower).toEqual(upper);
    });

    it("should filter personas by exact email", () => {
      const filters: PersonaFilters = { email: "ava@demo.org" };
      expect(filterPersonas(testPersonas, filters).map((persona) => persona.id)).toEqual([
        "pers-001",
      ]);
    });

    it("should filter personas by name substring", () => {
      const filters: PersonaFilters = { name: "Rodriguez" };
      expect(filterPersonas(testPersonas, filters).map((persona) => persona.id)).toEqual([
        "pers-003",
      ]);
    });

    it("should filter personas by stellar address", () => {
      const filters: PersonaFilters = {
        stellarAddress: "GHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUV",
      };
      expect(filterPersonas(testPersonas, filters).map((persona) => persona.id)).toEqual([
        "pers-002",
      ]);
    });

    it("should combine persona filters and search query", () => {
      const filters: PersonaFilters = {
        name: "Liam",
        searchQuery: "demo.org",
      };
      const result = filterPersonas(testPersonas, filters);
      expect(result.map((persona) => persona.id)).toEqual(["pers-002"]);
    });
  });
});
