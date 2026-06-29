import type {
  AutoLabelConfidence,
  AutoLabelEmail,
  AutoLabelResult,
  AutoLabelSuggestion,
} from "./types";

export const AUTO_LABEL_TAXONOMY = [
  "Action needed",
  "Finance",
  "Stellar",
  "Security",
  "Calendar",
  "Newsletter",
] as const;

export type AutoLabelName = (typeof AUTO_LABEL_TAXONOMY)[number];

const MAX_SUGGESTIONS = 3;

interface RuleMatch {
  label: AutoLabelName;
  score: number;
  reason: string;
  evidence: string;
}

interface LabelRule {
  label: AutoLabelName;
  priority: number;
  reason: string;
  highScore: number;
  patterns: RegExp[];
}

const labelRules: LabelRule[] = [
  {
    label: "Security",
    priority: 1,
    reason: "Security-sensitive sign-in or account language was detected.",
    highScore: 2,
    patterns: [
      /\b(one[-\s]?time code|verification code|otp|password reset|suspicious sign[-\s]?in|reset your password|signing in)\b/i,
    ],
  },
  {
    label: "Finance",
    priority: 2,
    reason: "Billing, payment, receipt, payout, or refund language was detected.",
    highScore: 2,
    patterns: [/\b(invoice|receipt|payout|refund|payment|billing|pay|paid|reconciliation)\b/i],
  },
  {
    label: "Stellar",
    priority: 3,
    reason: "Stellar or wallet-specific payment language was detected.",
    highScore: 2,
    patterns: [/\b(xlm|usdc|stellar|wallet|transaction hash|memo|on[-\s]?chain)\b/i],
  },
  {
    label: "Action needed",
    priority: 5,
    reason: "The message asks the user to review, confirm, approve, pay, or act by a deadline.",
    highScore: 2,
    patterns: [
      /\b(please review|please confirm|approval required|approve|need approval|can we|reply|pay)\b/i,
      /\b(due today|before noon|before end of day|by \w+ \d{1,2}|expires tonight|deadline)\b/i,
    ],
  },
  {
    label: "Calendar",
    priority: 4,
    reason: "Meeting, invite, agenda, time, or rescheduling language was detected.",
    highScore: 2,
    patterns: [
      /\b(meeting|invite|reschedule|agenda|calendar|onboarding review|\d{1,2}\s?(am|pm))\b/i,
    ],
  },
  {
    label: "Newsletter",
    priority: 6,
    reason: "Digest, update, release, or unsubscribe language suggests a newsletter.",
    highScore: 2,
    patterns: [
      /\b(unsubscribe|weekly digest|release digest|product update|preferences|this month'?s)\b/i,
    ],
  },
];

export function validateAutoLabelEmail(input: Partial<AutoLabelEmail>): string[] {
  const errors: string[] = [];

  if (!input.id || input.id.trim().length === 0) errors.push("Email id is required.");
  if (!input.from || input.from.trim().length === 0) errors.push("Email sender is required.");
  if (!input.subject || input.subject.trim().length === 0)
    errors.push("Email subject is required.");
  if (!input.snippet || input.snippet.trim().length === 0)
    errors.push("Email snippet is required.");
  if (input.receivedAt && Number.isNaN(Date.parse(input.receivedAt))) {
    errors.push("receivedAt must be an ISO-compatible date when provided.");
  }

  return errors;
}

export function suggestAutoLabels(input: AutoLabelEmail): AutoLabelResult {
  const validationErrors = validateAutoLabelEmail(input);
  const preservedExistingLabels = [...(input.existingLabels ?? [])];

  if (validationErrors.length > 0) {
    return {
      status: "error",
      suggestions: [],
      preservedExistingLabels,
      validationErrors,
      source: "local-deterministic-rules",
    };
  }

  return {
    status: "success",
    suggestions: rankMatches(matchRules(input), preservedExistingLabels),
    preservedExistingLabels,
    validationErrors: [],
    source: "local-deterministic-rules",
  };
}

function matchRules(input: AutoLabelEmail): RuleMatch[] {
  const text = normalizeWhitespace(
    [input.from, input.subject, input.snippet, input.bodyPreview].filter(Boolean).join(". "),
  );

  return labelRules.flatMap((rule) => {
    const evidence = rule.patterns
      .map((pattern) => extractEvidence(text, pattern))
      .filter(Boolean) as string[];

    if (evidence.length === 0) return [];

    return [
      { label: rule.label, score: evidence.length, reason: rule.reason, evidence: evidence[0] },
    ];
  });
}

function rankMatches(matches: RuleMatch[], existingLabels: string[]): AutoLabelSuggestion[] {
  const existing = new Set(existingLabels.map((label) => label.toLowerCase()));

  return matches
    .filter((match) => !existing.has(match.label.toLowerCase()))
    .sort((a, b) => {
      const priorityDelta = priorityFor(a.label) - priorityFor(b.label);
      return priorityDelta || b.score - a.score || a.label.localeCompare(b.label);
    })
    .slice(0, MAX_SUGGESTIONS)
    .map((match) => ({
      label: match.label,
      confidence: confidenceFor(match.score, match.label),
      reason: match.reason,
      evidence: match.evidence,
    }));
}

function confidenceFor(score: number, label: AutoLabelName): AutoLabelConfidence {
  const rule = labelRules.find((candidate) => candidate.label === label);
  if (score >= (rule?.highScore ?? 2)) return "high";
  return score === 1 ? "medium" : "low";
}

function priorityFor(label: AutoLabelName): number {
  return labelRules.find((rule) => rule.label === label)?.priority ?? 99;
}

function extractEvidence(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  if (!match?.[0]) return undefined;

  const index = match.index ?? 0;
  const start = Math.max(0, index - 32);
  const end = Math.min(text.length, index + match[0].length + 32);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
