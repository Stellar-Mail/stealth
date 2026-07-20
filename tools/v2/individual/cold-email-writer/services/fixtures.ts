import { COLD_EMAIL_INPUT_LIMITS } from "./guards";
import type {
  ColdEmailWriterErrorCode,
  ColdEmailWriterInput,
  ColdEmailWriterOptions,
} from "../types/coldEmailWriter";

export interface ColdEmailSuccessFixture {
  name: string;
  input: ColdEmailWriterInput;
  options?: ColdEmailWriterOptions;
  expectedTone: "professional" | "friendly" | "direct";
}

export interface ColdEmailFailureFixture {
  name: string;
  input: unknown;
  options?: unknown;
  expectedCode: ColdEmailWriterErrorCode;
}

export const successFixtures: ColdEmailSuccessFixture[] = [
  {
    name: "professional-with-proof",
    input: {
      requestId: "cold-001",
      sender: { name: "Amina", company: "Northstar" },
      recipient: { name: "Jordan", company: "Acme", role: "Sales Director" },
      offer: "a faster lead-research workflow",
      valueProposition: "Northstar helps sales teams prepare relevant outreach in minutes.",
      callToAction: "Would a 15-minute walkthrough next Tuesday be useful?",
      proofPoints: ["reduced research time by 40% for a 20-person sales team"],
    },
    expectedTone: "professional",
  },
  {
    name: "friendly-without-subject",
    input: {
      requestId: "cold-002",
      sender: { name: "Kai" },
      recipient: { name: "Sam", role: "Founder" },
      offer: "automated customer follow-ups",
      valueProposition: "It keeps promising conversations from going quiet.",
      callToAction: "Open to comparing notes this week?",
      tone: "friendly",
    },
    options: { includeSubject: false, maxBodyWords: 80 },
    expectedTone: "friendly",
  },
];

export const failureFixtures: ColdEmailFailureFixture[] = [
  {
    name: "missing-recipient",
    input: {
      requestId: "cold-invalid",
      sender: { name: "Amina" },
      offer: "an offer",
      valueProposition: "some value",
      callToAction: "Talk?",
    },
    expectedCode: "invalid-input",
  },
  {
    name: "empty-recipient-name",
    input: {
      requestId: "cold-empty",
      sender: { name: "Amina" },
      recipient: { name: "\u200b" },
      offer: "an offer",
      valueProposition: "some value",
      callToAction: "Talk?",
    },
    expectedCode: "empty-content",
  },
  {
    name: "oversized-offer",
    input: {
      requestId: "cold-large",
      sender: { name: "Amina" },
      recipient: { name: "Jordan" },
      offer: "x".repeat(COLD_EMAIL_INPUT_LIMITS.contentFieldChars + 1),
      valueProposition: "some value",
      callToAction: "Talk?",
    },
    expectedCode: "input-too-large",
  },
  {
    name: "invalid-options",
    input: {
      requestId: "cold-options",
      sender: { name: "Amina" },
      recipient: { name: "Jordan" },
      offer: "an offer",
      valueProposition: "some value",
      callToAction: "Talk?",
    },
    options: { maxBodyWords: 0 },
    expectedCode: "invalid-options",
  },
];
