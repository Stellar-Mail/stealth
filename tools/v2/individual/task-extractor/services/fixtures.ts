// Task Extractor — typed fixtures for the execution contract.
//
// Deterministic sample payloads used by tests and by consumers who want a
// known-good reference for wiring the service. Success fixtures pass the
// guarded entry point; failure fixtures each trigger a specific error code.

import { GUARD_LIMITS } from "./guards";
import type { TaskExtractionErrorCode, TaskExtractionInput } from "../types/taskExtractor";

export interface SuccessFixture {
  name: string;
  input: TaskExtractionInput;
  /** Task texts the engine is expected to extract, in order. */
  expectedTaskTexts: string[];
}

export interface FailureFixture {
  name: string;
  /** Intentionally loosely typed — failure fixtures model bad payloads. */
  input: unknown;
  expectedCode: TaskExtractionErrorCode;
}

export const successFixtures: SuccessFixture[] = [
  {
    name: "explicit-requests",
    input: {
      messageId: "msg-requests-001",
      subject: "Two things before the launch",
      body: [
        "Hi team,",
        "Please review the launch checklist and flag anything missing.",
        "Could you send the final pricing sheet to legal?",
        "Thanks!",
      ].join("\n"),
      senderAddress: "amina@example.com",
      receivedAt: "2026-07-01T09:15:00.000Z",
      language: "en",
    },
    expectedTaskTexts: [
      "review the launch checklist and flag anything missing",
      "send the final pricing sheet to legal",
    ],
  },
  {
    name: "checkbox-and-bullet-list",
    input: {
      messageId: "msg-list-001",
      subject: "Sprint prep",
      body: [
        "Before Monday standup:",
        "- [ ] Update the roadmap deck",
        "- review open pull requests by 2026-07-10",
        "- lunch menu ideas",
      ].join("\n"),
      receivedAt: "2026-07-02T14:30:00.000Z",
    },
    expectedTaskTexts: ["Update the roadmap deck", "review open pull requests by 2026-07-10"],
  },
  {
    name: "urgent-request-with-relative-due",
    input: {
      messageId: "msg-urgent-001",
      subject: "Action required: contract signature",
      body: "Please sign the vendor contract by tomorrow, this is urgent.",
      receivedAt: "2026-07-03T08:00:00.000Z",
    },
    expectedTaskTexts: [
      "contract signature",
      "sign the vendor contract by tomorrow, this is urgent",
    ],
  },
  {
    name: "no-tasks-found",
    input: {
      messageId: "msg-none-001",
      subject: "Weekly notes",
      body: "It was a quiet week. The office closes early on the holiday.",
    },
    expectedTaskTexts: [],
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
      body: "Please review this",
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
      body: "Merci de relire le document.",
      language: "fr",
    },
    expectedCode: "unsupported-language",
  },
];
