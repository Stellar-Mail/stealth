// Readability Improver — typed fixtures for the execution contract.
//
// Deterministic sample payloads used by tests and by consumers who want a
// known-good reference for wiring the service. Success fixtures pass the
// guarded entry point; failure fixtures each trigger a specific error code.

import { GUARD_LIMITS } from "./guards";
import type {
  ReadabilityErrorCode,
  ReadabilityInput,
  ReadabilityIssueType,
} from "../types/readabilityImprover";

export interface SuccessFixture {
  name: string;
  input: ReadabilityInput;
  /** Issue types the engine is expected to report, in order. */
  expectedIssueTypes: ReadabilityIssueType[];
}

export interface FailureFixture {
  name: string;
  /** Intentionally loosely typed — failure fixtures model bad payloads. */
  input: unknown;
  expectedCode: ReadabilityErrorCode;
}

export const successFixtures: SuccessFixture[] = [
  {
    name: "clean-plain-text",
    input: {
      messageId: "msg-clean-001",
      subject: "Lunch on Friday",
      body: "Want to grab lunch on Friday? The new place is close by. My treat.",
      senderAddress: "amina@example.com",
      receivedAt: "2026-07-01T09:15:00.000Z",
      language: "en",
    },
    expectedIssueTypes: [],
  },
  {
    name: "wordy-formal-memo",
    input: {
      messageId: "msg-wordy-001",
      subject: "Process update",
      body: "We will utilize the new workflow to facilitate onboarding and we expect that every team, including the ones that joined after the reorganization earlier this year, will subsequently adopt it before the next quarterly planning cycle begins.",
      receivedAt: "2026-07-02T14:30:00.000Z",
    },
    expectedIssueTypes: ["long-sentence", "complex-word", "complex-word", "complex-word"],
  },
  {
    name: "passive-and-shouting",
    input: {
      messageId: "msg-loud-001",
      subject: "URGENT PLEASE READ",
      body: "The report was completed by the intern. Send feedback this week.",
    },
    expectedIssueTypes: ["shouting", "passive-voice"],
  },
];

export const failureFixtures: FailureFixture[] = [
  {
    name: "missing-body",
    input: {
      messageId: "msg-invalid-001",
      subject: "No body field on this payload",
    },
    expectedCode: "invalid-input",
  },
  {
    name: "blank-message-id",
    input: {
      messageId: "   ",
      subject: "Hello",
      body: "Some text",
    },
    expectedCode: "invalid-input",
  },
  {
    name: "oversized-body",
    input: {
      messageId: "msg-oversized-001",
      subject: "Huge payload",
      body: "x".repeat(GUARD_LIMITS.maxBodyChars + 1),
    },
    expectedCode: "input-too-large",
  },
  {
    name: "empty-content",
    input: {
      messageId: "msg-empty-001",
      subject: "   ",
      body: "\u200b\u200b",
    },
    expectedCode: "empty-content",
  },
  {
    name: "unsupported-language",
    input: {
      messageId: "msg-lang-001",
      subject: "Bonjour",
      body: "Merci de simplifier ce texte.",
      language: "fr",
    },
    expectedCode: "unsupported-language",
  },
];
