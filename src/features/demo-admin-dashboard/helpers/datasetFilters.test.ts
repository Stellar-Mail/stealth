import { describe, expect, it } from "vitest";
import type { Draft } from "../types/draft";
import type { Persona } from "../types/persona";
import {
  filterDrafts,
  filterPersonas,
  scoreDraftMatch,
  scorePersonaMatch,
  searchDrafts,
  searchPersonas,
} from "./datasetFilters";

const drafts: Draft[] = [
  {
    id: "1",
    subject: "Launch plan",
    body: "Internal notes",
    recipients: ["alice@example.com"],
  },
  {
    id: "2",
    subject: "Random subject",
    body: "Launch details inside",
    recipients: ["bob@example.com"],
  },
  {
    id: "3",
    subject: "Unrelated",
    body: "Nothing here",
    recipients: ["carol@example.com"],
  },
];

const personas: Persona[] = [
  {
    id: "p1",
    name: "Alice Demo",
    email: "alice@example.com",
    stellarAddress: "alice*stealth.demo",
    avatar: "",
  },
  {
    id: "p2",
    name: "Bob Demo",
    email: "bob@example.com",
    stellarAddress: "bob*stealth.demo",
    avatar: "",
  },
];

describe("scoreDraftMatch", () => {
  it("returns 0 for an empty query", () => {
    expect(scoreDraftMatch(drafts[0], "")).toBe(0);
  });

  it("scores an exact subject match highest", () => {
    expect(scoreDraftMatch(drafts[0], "launch plan")).toBe(100);
  });

  it("adds points per matching recipient", () => {
    const draft: Draft = {
      id: "x",
      subject: "Subject",
      body: "Body",
      recipients: ["a@example.com", "b@example.com"],
    };
    expect(scoreDraftMatch(draft, "example.com")).toBe(30);
  });
});

describe("searchDrafts", () => {
  it("returns the input unchanged for an empty query", () => {
    expect(searchDrafts(drafts, "  ")).toBe(drafts);
  });

  it("returns matches sorted by score", () => {
    expect(searchDrafts(drafts, "launch").map((draft) => draft.id)).toEqual(["1", "2"]);
  });
});

describe("filterDrafts", () => {
  it("filters by exact recipient (case-insensitive)", () => {
    expect(
      filterDrafts(drafts, { recipient: "ALICE@example.com" }).map((draft) => draft.id),
    ).toEqual(["1"]);
  });

  it("returns the input unchanged for empty filters", () => {
    expect(filterDrafts(drafts, {})).toBe(drafts);
  });
});

describe("persona filtering", () => {
  it("scores an exact name match highest", () => {
    expect(scorePersonaMatch(personas[0], "alice demo")).toBe(100);
  });

  it("searches personas by name", () => {
    expect(searchPersonas(personas, "alice").map((persona) => persona.id)).toEqual(["p1"]);
  });

  it("filters personas by exact email", () => {
    expect(
      filterPersonas(personas, { email: "BOB@example.com" }).map((persona) => persona.id),
    ).toEqual(["p2"]);
  });
});
