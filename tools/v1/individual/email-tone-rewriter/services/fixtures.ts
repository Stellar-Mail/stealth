import type { RewriteRequest } from "./emailToneRewriter";

export interface RewriterFixture {
  description: string;
  request: RewriteRequest;
}

/** Synthetic drafts mirroring docs/fixtures.md. No real personal data. */
export const FORMAL_FOLLOW_UP: RewriteRequest = {
  id: "tone-formal-follow-up",
  subject: "Following up",
  bodyText: "Hey Sam, can you send the Q3 invoice by Friday? We need it before the launch review.",
  tone: "formal",
  maxWords: 80,
};

export const FRIENDLY_DELAY: RewriteRequest = {
  id: "tone-friendly-apology",
  subject: "Delay update",
  bodyText: "The report is late. I will send it tomorrow morning.",
  tone: "friendly",
  maxWords: 60,
};

/** Tone is intentionally invalid to exercise validation. */
export const UNSUPPORTED_TONE_DRAFT = {
  id: "tone-unsupported",
  subject: "Unsupported tone",
  bodyText: "Please review this draft.",
  tone: "sarcastic",
  maxWords: 50,
};

export const EMPTY_BODY_DRAFT: RewriteRequest = {
  id: "empty-body",
  subject: "No content",
  bodyText: "   ",
  tone: "concise",
};

export const SAMPLE_DRAFTS: RewriterFixture[] = [
  {
    description: "Casual follow-up rewritten formally.",
    request: FORMAL_FOLLOW_UP,
  },
  {
    description: "Blunt delay note softened for a friendly tone.",
    request: FRIENDLY_DELAY,
  },
];
