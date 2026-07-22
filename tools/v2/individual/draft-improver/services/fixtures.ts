import type { DraftInput } from "./types";

/**
 * Deterministic sample drafts used for local review and manual exploration of
 * the engine. These are static fixtures only: they involve no network access,
 * secrets, or real user data.
 */
export interface DraftFixture {
  id: string;
  label: string;
  input: DraftInput;
}

export const DRAFT_FIXTURES: readonly DraftFixture[] = [
  {
    id: "clean",
    label: "Clear, well-structured note",
    input: {
      subject: "Project kickoff on Thursday",
      body: "Hi Sam,\n\nThanks for the update. Let's meet Thursday at 10am to agree on scope and owners.\n\nBest,\nAlex",
    },
  },
  {
    id: "rambling",
    label: "Long, hedging, filler-heavy draft",
    input: {
      subject: "quick thoughts about the thing we sort of discussed and maybe some next steps",
      body: "I just wanted to actually reach out because I think we should probably really sync sometime soon, and I guess it would be basically great if we could maybe find a time that works for everyone so that we can go over literally everything in one very long conversation.",
    },
  },
  {
    id: "shouty",
    label: "All-caps and excessive punctuation",
    input: {
      subject: "URGENT",
      body: "PLEASE respond ASAP!!! This is REALLY important!!!",
    },
  },
  {
    id: "empty",
    label: "Empty body (error case)",
    input: {
      subject: "No content",
      body: "   ",
    },
  },
];
