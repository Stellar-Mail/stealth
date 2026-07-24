import type {
  DraftImprovementResult,
  DraftImproverServiceOptions,
  DraftInput,
  DraftIssue,
  DraftIssueCategory,
  DraftIssueSeverity,
  DraftScore,
  DraftSuggestion,
  ParsedDraft,
  SanitizedDraft,
} from "../types";

const DEFAULT_MAX_SUBJECT_LENGTH = 100;
const DEFAULT_MAX_BODY_LENGTH = 100_000;
const DEFAULT_MAX_INPUT_SIZE_BYTES = 200_000;

const SENSITIVE_PATTERNS = [
  /\bpassword(?!\s*policy)/gi,
  /\b(?:api[_-]?key|api[_-]?secret)\b/gi,
  /\bsecret\b(?![.\s]*?(?:sauce|ingredient|agent|santa))/gi,
  /\b(?:ssn|social[.\s]*security[.\s]*(?:number|no))\b/gi,
  /\bcredit[.\s]*card\b/gi,
  /\b(?:private[.\s]*key|pem\b)(?![.\s]*fig)/gi,
  /\btoken\b(?![.\s]*stub|placeholder)/gi,
];

const SPELLING_SUGGESTIONS: Record<string, string[]> = {
  recieve: ["receive"],
  occured: ["occurred"],
  ocurred: ["occurred"],
  definately: ["definitely"],
  definitly: ["definitely"],
  seperate: ["separate"],
  availble: ["available"],
  wensday: ["Wednesday"],
  calender: ["calendar"],
  recuring: ["recurring"],
  refered: ["referred"],
  refering: ["referring"],
  commitee: ["committee"],
  commited: ["committed"],
  accomodate: ["accommodate"],
  embaras: ["embarrass"],
  neccessary: ["necessary"],
  occassion: ["occasion"],
  maintanance: ["maintenance"],
};

const COMMON_GREETING_PATTERNS = [
  /^(hi|hello|hey|dear|greetings|good\s*(morning|afternoon|evening|day))\b/i,
  /^(to|attn|attention):/i,
];

const COMMON_CLOSING_PATTERNS = [
  /^(best|cheers|thanks|regards|sincerely|yours|warmly|cordially|talk soon|looking forward)/i,
  /^(best\s+regards|kind\s+regards|warm\s+regards|with\s+thanks)$/i,
];

const ACTION_ITEM_PATTERNS = [
  /\bplease\s+\w+/i,
  /could\s+you\s+please/i,
  /let\s+me\s+know/i,
  /i\s+(?:will|would|can)\s+(?:send|check|update|follow|review)/i,
  /\bnext\s+steps?\b/i,
  /\baction\s+items?\b/i,
  /\bfollow[-\s]?up\b/i,
  /\bto[- \s]do\b/i,
];

const OVERLY_LONG_SENTENCE_THRESHOLD = 40;
const PASSIVE_VOICE_PATTERNS = /\b(?:am|is|are|was|were|been|being)\s+\w+ed\b/gi;

export function validateDraftInput(
  input: unknown,
  options: DraftImproverServiceOptions = {},
): { valid: boolean; error?: string; sanitized?: DraftInput } {
  const maxSizeBytes = options.maxInputSizeBytes ?? DEFAULT_MAX_INPUT_SIZE_BYTES;

  if (input === null || input === undefined) {
    return { valid: false, error: "Input is null or undefined" };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, error: "Input must be a non-null object" };
  }

  const raw = input as Record<string, unknown>;

  if (typeof raw.id !== "string" || raw.id.length === 0) {
    return { valid: false, error: "id must be a non-empty string" };
  }

  if (typeof raw.subject !== "string") {
    return { valid: false, error: "subject must be a string" };
  }

  if (typeof raw.body !== "string") {
    return { valid: false, error: "body must be a string" };
  }

  const totalBytes = new TextEncoder().encode(raw.subject + raw.body).length;
  if (totalBytes > maxSizeBytes) {
    return {
      valid: false,
      error: `Input size (${totalBytes} bytes) exceeds maximum allowed (${maxSizeBytes} bytes)`,
    };
  }

  if (raw.containsPersonalData !== undefined && typeof raw.containsPersonalData !== "boolean") {
    return { valid: false, error: "containsPersonalData must be a boolean" };
  }

  const sanitized: DraftInput = {
    id: raw.id as string,
    subject: (raw.subject as string).slice(0, DEFAULT_MAX_SUBJECT_LENGTH * 2),
    body: (raw.body as string).slice(0, DEFAULT_MAX_BODY_LENGTH),
    recipientName:
      typeof raw.recipientName === "string" ? raw.recipientName.slice(0, 200) : undefined,
    senderName: typeof raw.senderName === "string" ? raw.senderName.slice(0, 200) : undefined,
    maxSubjectLength:
      typeof raw.maxSubjectLength === "number" && raw.maxSubjectLength > 0
        ? Math.min(raw.maxSubjectLength, 200)
        : undefined,
    maxBodyLength:
      typeof raw.maxBodyLength === "number" && raw.maxBodyLength > 0
        ? Math.min(raw.maxBodyLength, 500_000)
        : undefined,
    containsPersonalData: raw.containsPersonalData === true,
  };

  return { valid: true, sanitized };
}

export function sanitizeDraft(
  input: DraftInput,
  options: DraftImproverServiceOptions = {},
): SanitizedDraft {
  const maxSubjectLength =
    input.maxSubjectLength ?? options.maxSubjectLength ?? DEFAULT_MAX_SUBJECT_LENGTH;
  const maxBodyLength = input.maxBodyLength ?? options.maxBodyLength ?? DEFAULT_MAX_BODY_LENGTH;

  const originalSubjectLength = input.subject.length;
  const originalBodyLength = input.body.length;

  let subject = input.subject.slice(0, maxSubjectLength);
  let body = input.body.slice(0, maxBodyLength);

  const wasTruncated = subject.length < originalSubjectLength || body.length < originalBodyLength;

  function stripControlChars(s: string): string {
    let result = "";
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      const isControl =
        (code >= 0x00 && code <= 0x08) ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f);
      if (!isControl) result += s[i];
    }
    return result;
  }

  subject = stripControlChars(subject);
  body = stripControlChars(body);

  const wasSanitized = wasTruncated || subject.length < input.subject.length;

  return {
    subject,
    body,
    recipientName: input.recipientName ?? "",
    senderName: input.senderName ?? "",
    wasTruncated,
    wasSanitized,
    originalSubjectLength,
    originalBodyLength,
  };
}

export function parseDraft(sanitized: SanitizedDraft): ParsedDraft {
  const body = sanitized.body;
  const bodyLines = body.split("\n").filter((line) => line.trim().length > 0);

  const sentences = body.split(/[.!?]+\s+/).filter((s) => s.trim().length > 0);

  const words = body.split(/\s+/).filter((w) => w.length > 0);

  const firstLine = bodyLines[0] ?? "";
  const lastLine = bodyLines[bodyLines.length - 1] ?? "";

  const hasGreeting = COMMON_GREETING_PATTERNS.some((pattern) => pattern.test(firstLine));
  const hasClosing = COMMON_CLOSING_PATTERNS.some((pattern) => pattern.test(lastLine));
  const hasActionItem = ACTION_ITEM_PATTERNS.some((pattern) => pattern.test(body));
  const hasAttachment = /attach(?:ed|ment)?/i.test(body) || /see\s+attach/i.test(body);

  return {
    subject: sanitized.subject,
    body,
    recipientName: sanitized.recipientName,
    senderName: sanitized.senderName,
    subjectLength: sanitized.subject.length,
    bodyLength: body.length,
    bodyWordCount: words.length,
    bodySentenceCount: sentences.length,
    hasGreeting,
    hasClosing,
    hasActionItem,
    hasAttachment,
  };
}

function detectSensitiveContent(text: string): DraftIssue[] {
  const issues: DraftIssue[] = [];

  for (const pattern of SENSITIVE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const suggestions: DraftSuggestion[] = [
          {
            type: "remove",
            category: "sensitive-content",
            severity: "error",
            message: `Potential sensitive content detected: "${match}". Avoid sending secrets via email.`,
            originalText: match,
          },
        ];

        issues.push({
          category: "sensitive-content",
          severity: "error",
          message: `Draft contains text that looks like a sensitive credential or identifier: "${match}"`,
          suggestions,
        });
      }
    }
  }

  return issues;
}

function checkMissingFields(parsed: ParsedDraft, sanitized: SanitizedDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];

  if (!parsed.hasGreeting) {
    issues.push({
      category: "missing-field",
      severity: "warning",
      message: "No greeting detected at the start of the message.",
      suggestions: [
        {
          type: "insert",
          category: "missing-field",
          severity: "warning",
          message: "Consider adding a greeting such as 'Hi [Name],' at the beginning.",
          suggestedText: `Hi ${sanitized.recipientName || "[Name]"},\n\n`,
        },
      ],
    });
  }

  if (!parsed.hasClosing) {
    issues.push({
      category: "missing-field",
      severity: "warning",
      message: "No closing detected at the end of the message.",
      suggestions: [
        {
          type: "insert",
          category: "missing-field",
          severity: "warning",
          message: "Consider adding a closing such as 'Best regards' before your name.",
          suggestedText: "\n\nBest regards,\n" + (sanitized.senderName || "[Your Name]"),
        },
      ],
    });
  }

  if (parsed.subject.length === 0) {
    issues.push({
      category: "missing-field",
      severity: "error",
      message: "Subject line is empty.",
      suggestions: [
        {
          type: "insert",
          category: "missing-field",
          severity: "error",
          message: "Add a subject line that summarizes the purpose of the message.",
        },
      ],
    });
  }

  return issues;
}

function checkClarityAndStructure(parsed: ParsedDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];

  if (parsed.bodySentenceCount < 2 && parsed.bodyLength > 0) {
    issues.push({
      category: "structure",
      severity: "warning",
      message:
        "The body has only one sentence, which may be difficult to parse for complex requests.",
      suggestions: [
        {
          type: "rewrite",
          category: "structure",
          severity: "warning",
          message: "Break your message into a few shorter sentences for clarity.",
        },
      ],
    });
  }

  const longSentences: string[] = [];
  const sentences = parsed.body.split(/[.!?]+\s+/);
  for (const sentence of sentences) {
    if (sentence.split(/\s+/).length > OVERLY_LONG_SENTENCE_THRESHOLD) {
      longSentences.push(sentence.trim());
    }
  }

  if (longSentences.length > 0) {
    issues.push({
      category: "clarity",
      severity: "warning",
      message: `${longSentences.length} sentence(s) exceed ${OVERLY_LONG_SENTENCE_THRESHOLD} words. Consider splitting them for readability.`,
      suggestions: longSentences.map((sentence) => ({
        type: "rewrite",
        category: "clarity",
        severity: "warning",
        message: `Consider splitting this sentence into shorter ideas.`,
        originalText: sentence.slice(0, 120),
      })),
    });
  }

  return issues;
}

function checkTone(text: string): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const aggressivePatterns = [
    /\byou\s+(must|need\s+to|have\s+to|should)\b/i,
    /\b(?:urgent|asap)\b/i,
    /\b(?:angry|frustrated|disappointed)\b/i,
  ];

  for (const pattern of aggressivePatterns) {
    const match = text.match(pattern);
    if (match) {
      issues.push({
        category: "tone",
        severity: "info",
        message: `The phrase "${match[0]}" may come across as demanding. Consider softening the tone.`,
        suggestions: [
          {
            type: "rewrite",
            category: "tone",
            severity: "info",
            message: `Consider rephrasing "${match[0]}" to sound more collaborative.`,
            originalText: match[0],
          },
        ],
      });
    }
  }

  const passiveMatches = text.match(PASSIVE_VOICE_PATTERNS);
  if (passiveMatches && passiveMatches.length > 2) {
    issues.push({
      category: "clarity",
      severity: "info",
      message: `${passiveMatches.length} instances of passive voice detected. Consider using active voice for stronger writing.`,
      suggestions: [
        {
          type: "rewrite",
          category: "clarity",
          severity: "info",
          message: "Replace passive constructions with active voice where possible.",
        },
      ],
    });
  }

  return issues;
}

function checkSpelling(text: string): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const words = text.split(/\b/);

  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (clean.length < 3) continue;

    const suggestion = SPELLING_SUGGESTIONS[clean];
    if (suggestion) {
      issues.push({
        category: "spelling",
        severity: "error",
        message: `Possible spelling error: "${clean}". Did you mean: ${suggestion.join(", ")}?`,
        suggestions: suggestion.map((correction) => ({
          type: "replace",
          category: "spelling",
          severity: "error",
          message: `Replace "${clean}" with "${correction}"`,
          originalText: clean,
          suggestedText: correction,
        })),
      });
    }
  }

  return issues;
}

function checkLength(parsed: ParsedDraft, sanitized: SanitizedDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];

  if (sanitized.wasTruncated) {
    issues.push({
      category: "length",
      severity: "warning",
      message: `The draft was truncated from ${sanitized.originalSubjectLength + sanitized.originalBodyLength} characters to ${sanitized.subject.length + sanitized.body.length} characters to fit size limits.`,
      suggestions: [
        {
          type: "remove",
          category: "length",
          severity: "warning",
          message: "Consider shortening the draft before sending to stay within limits.",
        },
      ],
    });
  }

  if (parsed.bodyWordCount > 200) {
    issues.push({
      category: "length",
      severity: "info",
      message: `The body is ${parsed.bodyWordCount} words. Consider keeping it under 200 words for readability.`,
      suggestions: [
        {
          type: "rewrite",
          category: "length",
          severity: "info",
          message: "Try to keep the message concise.",
        },
      ],
    });
  }

  return issues;
}

function checkActionItems(parsed: ParsedDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];

  if (!parsed.hasActionItem && parsed.bodyLength > 0) {
    issues.push({
      category: "action-item",
      severity: "warning",
      message:
        "No clear action item or request detected. Recipients may not know what response is expected.",
      suggestions: [
        {
          type: "insert",
          category: "action-item",
          severity: "warning",
          message:
            "Add a clear call to action (e.g. 'Please review by Friday' or 'Let me know your thoughts').",
        },
      ],
    });
  }

  return issues;
}

function computeScore(parsed: ParsedDraft, issues: DraftIssue[]): DraftScore {
  let subjectScore = 100;
  if (parsed.subject.length === 0) subjectScore -= 40;
  else if (parsed.subject.length < 5) subjectScore -= 20;
  else if (parsed.subject.length > DEFAULT_MAX_SUBJECT_LENGTH) subjectScore -= 15;

  let bodyScore = 100;
  if (parsed.bodyLength === 0) bodyScore -= 50;
  else if (parsed.bodyWordCount < 5) bodyScore -= 30;

  let clarityScore = 100;
  let toneScore = 100;
  let structureScore = 100;

  for (const issue of issues) {
    const severity = issue.severity;
    const deduction = severity === "error" ? 15 : severity === "warning" ? 8 : 3;

    switch (issue.category) {
      case "spelling":
      case "grammar":
      case "clarity":
        clarityScore = Math.max(0, clarityScore - deduction);
        break;
      case "tone":
        toneScore = Math.max(0, toneScore - deduction);
        break;
      case "structure":
      case "missing-field":
        structureScore = Math.max(0, structureScore - deduction);
        break;
      case "length":
        bodyScore = Math.max(0, bodyScore - deduction);
        break;
      case "action-item":
        structureScore = Math.max(0, structureScore - deduction);
        break;
    }
  }

  const overall = Math.round(
    (subjectScore + bodyScore + clarityScore + toneScore + structureScore) / 5,
  );

  return {
    overall,
    subject: subjectScore,
    body: bodyScore,
    clarity: clarityScore,
    tone: toneScore,
    structure: structureScore,
  };
}

function generateSummary(score: DraftScore, totalIssues: number, errorCount: number): string {
  if (errorCount > 0) {
    return "Critical issues found. Review and fix errors before sending.";
  }
  if (score.overall >= 90) {
    return "Draft looks good. Minor improvements suggested.";
  }
  if (score.overall >= 70) {
    return `${totalIssues} improvement(s) suggested. Review recommendations to strengthen your message.`;
  }
  return `${totalIssues} issue(s) found. Consider revising for clarity and completeness.`;
}

function deduplicateIssues(issues: DraftIssue[]): DraftIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.category}:${issue.severity}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function analyzeDraft(
  rawInput: unknown,
  options: DraftImproverServiceOptions = {},
): { result?: DraftImprovementResult; error?: string } {
  const validation = validateDraftInput(rawInput, options);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const input = validation.sanitized!;

  if (options.enableSensitiveContentCheck === false && input.containsPersonalData) {
    return {
      error:
        "Cannot process draft containing personal data when sensitive content checks are disabled.",
    };
  }

  const sanitized = sanitizeDraft(input, options);
  const parsed = parseDraft(sanitized);

  const allIssues: DraftIssue[] = [];

  allIssues.push(...checkMissingFields(parsed, sanitized));
  allIssues.push(...checkClarityAndStructure(parsed));
  allIssues.push(...checkTone(sanitized.body + " " + sanitized.subject));
  allIssues.push(...checkLength(parsed, sanitized));
  allIssues.push(...checkActionItems(parsed));

  if (options.enableSpellCheck !== false) {
    allIssues.push(...checkSpelling(sanitized.body + " " + sanitized.subject));
  }

  if (options.enableSensitiveContentCheck !== false) {
    allIssues.push(...detectSensitiveContent(sanitized.body + " " + sanitized.subject));
  }

  const issues = deduplicateIssues(allIssues);

  const suggestions: DraftSuggestion[] = issues.flatMap((issue) => issue.suggestions);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  const score = computeScore(parsed, issues);
  const summary = generateSummary(score, issues.length, errorCount);

  return {
    result: {
      inputId: input.id,
      parsed,
      sanitized,
      issues,
      suggestions,
      score,
      summary,
      totalIssues: issues.length,
      errorCount,
      warningCount,
      infoCount,
    },
  };
}
