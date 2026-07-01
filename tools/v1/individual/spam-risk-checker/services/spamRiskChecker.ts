export type SpamRiskLevel = "low" | "medium" | "high";

export interface SpamRiskAnalysis {
  score: number;
  level: SpamRiskLevel;
  reasons: string[];
  summary: string;
}

export interface SpamRiskInput {
  subject?: string;
  body?: string;
}

const URGENCY_PATTERN = /\b(urgent|immediately|act now|click now|limited time|final notice)\b/i;
const SPAM_BAIT_PATTERN =
  /\b(free|winner|prize|cash|guaranteed|claim now|verify your account|reset your password)\b/i;
const FINANCE_PATTERN = /\b(crypto|bitcoin|investment|make money|earn money)\b/i;
const SHORTENED_LINK_PATTERN = /\b(bit\.ly|tinyurl|t\.co|ow\.ly)\b/i;
const EXTERNAL_LINK_PATTERN = /https?:\/\/\S+/i;

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim();
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function classifyScore(score: number): SpamRiskLevel {
  if (score >= 5) {
    return "high";
  }

  if (score >= 2) {
    return "medium";
  }

  return "low";
}

export function analyzeSpamRisk(input: string | SpamRiskInput): SpamRiskAnalysis {
  const text =
    typeof input === "string" ? input : [input.subject, input.body].map(normalizeText).join("\n");
  const trimmedText = normalizeText(text);

  if (!trimmedText) {
    return {
      score: 0,
      level: "low",
      reasons: [],
      summary: "No content was provided for review.",
    };
  }

  const reasons: string[] = [];
  let score = 0;

  if (URGENCY_PATTERN.test(trimmedText)) {
    score += 2;
    reasons.push("Urgency language");
  }

  if (SPAM_BAIT_PATTERN.test(trimmedText)) {
    score += 2;
    reasons.push("Common spam bait phrases");
  }

  if (FINANCE_PATTERN.test(trimmedText)) {
    score += 2;
    reasons.push("Financial promises");
  }

  if (SHORTENED_LINK_PATTERN.test(trimmedText) || EXTERNAL_LINK_PATTERN.test(trimmedText)) {
    score += 1;
    reasons.push("External links");
  }

  if (/!{2,}/.test(trimmedText)) {
    score += 1;
    reasons.push("Excessive punctuation");
  }

  const uppercaseWords = trimmedText.match(/\b[A-Z]{4,}\b/g) ?? [];
  if (uppercaseWords.length > 0) {
    score += Math.min(uppercaseWords.length, 2);
    reasons.push("All-caps emphasis");
  }

  const level = classifyScore(score);
  const verb =
    level === "high" ? "looks suspicious" : level === "medium" ? "needs caution" : "looks ordinary";

  return {
    score,
    level,
    reasons: dedupe(reasons),
    summary: `This message ${verb} based on ${reasons.length || 1} signal${reasons.length === 1 ? "" : "s"}.`,
  };
}
