// Sentiment Detector — typed fixtures for the execution contract.
//
// Deterministic sample payloads used by tests and by consumers who want a
// known-good reference for wiring the service. Success fixtures pass the
// guarded entry point; failure fixtures each trigger a specific error code.

import { GUARD_LIMITS } from "./guards";
import type {
  SentimentAnalysisInput,
  SentimentErrorCode,
  SentimentLabel,
} from "../types/sentimentDetector";

export interface SuccessFixture {
  name: string;
  input: SentimentAnalysisInput;
  expectedSentiment: SentimentLabel;
}

export interface FailureFixture {
  name: string;
  /** Intentionally loosely typed — failure fixtures model bad payloads. */
  input: unknown;
  expectedCode: SentimentErrorCode;
}

export const successFixtures: SuccessFixture[] = [
  {
    name: "positive-reply",
    input: {
      messageId: "msg-positive-001",
      subject: "Great news, thank you!",
      body: "Really appreciate the quick turnaround. The fix works and I am very happy with the result.",
      senderAddress: "amina@example.com",
      receivedAt: "2026-07-01T09:15:00.000Z",
      language: "en",
    },
    expectedSentiment: "positive",
  },
  {
    name: "negative-complaint",
    input: {
      messageId: "msg-negative-001",
      subject: "Urgent problem with my order",
      body: "This is unacceptable. The delivery failed twice and support has been terrible. I am extremely frustrated and want a refund.",
      senderAddress: "colin@example.com",
      receivedAt: "2026-07-02T14:30:00.000Z",
    },
    expectedSentiment: "negative",
  },
  {
    name: "mixed-feedback",
    input: {
      messageId: "msg-mixed-001",
      subject: "Feedback on the new release",
      body: "The new dashboard is excellent and I love the search, but the export is broken and the sync problem is still there.",
      receivedAt: "2026-07-03T08:00:00.000Z",
    },
    expectedSentiment: "mixed",
  },
  {
    name: "neutral-notice",
    input: {
      messageId: "msg-neutral-001",
      subject: "Meeting moved to Thursday",
      body: "The weekly sync now starts at 10:00 in the same room. Agenda unchanged.",
    },
    expectedSentiment: "neutral",
  },
  {
    name: "negated-positive-reads-negative",
    input: {
      messageId: "msg-negated-001",
      subject: "Order update",
      body: "I am not happy with this experience and the packaging was not good either.",
    },
    expectedSentiment: "negative",
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
      body: "Merci beaucoup pour votre aide.",
      language: "fr",
    },
    expectedCode: "unsupported-language",
  },
];
