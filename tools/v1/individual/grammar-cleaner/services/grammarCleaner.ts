export type GrammarIssueCategory =
  | "spelling"
  | "grammar"
  | "punctuation"
  | "capitalization"
  | "redundancy";

export interface TextRange {
  start: number;
  end: number;
}

export interface GrammarIssue {
  type: GrammarIssueCategory;
  location: TextRange;
  original: string;
  suggestion: string;
  explanation: string;
}

export interface GrammarInput {
  subject?: string;
  bodyText: string;
}

export interface GrammarResult {
  originalText: string;
  correctedText: string;
  issues: GrammarIssue[];
  issueCount: number;
  changed: boolean;
}

export type GrammarErrorCode =
  | "empty-body"
  | "unsupported-input"
  | "input-too-large"
  | "unsupported-dataset";

export type GrammarResultStatus =
  | { status: "ok"; result: GrammarResult }
  | { status: "error"; code: GrammarErrorCode; message: string };

export type GrammarState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: GrammarResult }
  | { status: "error"; code: GrammarErrorCode; message: string };

interface ReplacementRule {
  pattern: RegExp;
  replacement: string;
  type: GrammarIssueCategory;
  explanation: string;
  wordBoundary?: boolean;
}

const HOMOPHONE_RULES: ReplacementRule[] = [
  {
    pattern: /\byoure\b/gi,
    replacement: "you're",
    type: "spelling",
    explanation: "Use 'you're' as a contraction of 'you are'.",
  },
  {
    pattern:
      /\bits\s+(?!own|base|surface|size|shape|color|name|purpose|function|status|value|type|role|job|turn|best|worst|own|way)\b(?!(?:not|been|being|also|still|already|always|often|just|only|even|never|ever|all|both|each|every|some|any|no|the|a|an)\b)/gi,
    replacement: "it's",
    type: "spelling",
    explanation: "Use 'it's' as a contraction of 'it is' or 'it has'.",
  },
  {
    pattern:
      /\byour\s+(ready|done|finished|late|early|here|there|back|not|also|still|already|always|never|just|only|even|all|going|coming|working|happy|sorry|right|wrong|welcome|aware|concerned|interested|the\b)/gi,
    replacement: "you're $1",
    type: "spelling",
    explanation: "Use 'you're' as a contraction of 'you are' before a description.",
  },
  {
    pattern: /\btheirs\s+(a|an|alot|a lot|many|much|no|not)\b/gi,
    replacement: "there's $1",
    type: "spelling",
    explanation: "Use 'there's' when you mean 'there is'.",
  },
  {
    pattern: /\baccidently\b/gi,
    replacement: "accidentally",
    type: "spelling",
    explanation: "'Accidentally' includes the '-ally' ending.",
  },
  {
    pattern: /\baffect\b/gi,
    replacement: "effect",
    type: "spelling",
    explanation: "Use 'effect' (noun) for results; 'affect' is usually a verb.",
  },
  {
    pattern: /\bteh\b/gi,
    replacement: "the",
    type: "spelling",
    explanation: "Common typo: 'teh' should be 'the'.",
  },
  {
    pattern: /\breciev(e|ed|es|ing)\b/gi,
    replacement: "receiv$1",
    type: "spelling",
    explanation: "'receive' follows 'i before e except after c'.",
  },
  {
    pattern: /\bacheive\b/gi,
    replacement: "achieve",
    type: "spelling",
    explanation: "'achieve' follows 'i before e'.",
  },
  {
    pattern: /\bdefinately\b/gi,
    replacement: "definitely",
    type: "spelling",
    explanation: "'definitely' has two 'i's, not an 'a'.",
  },
  {
    pattern: /\boccurence\b/gi,
    replacement: "occurrence",
    type: "spelling",
    explanation: "'occurrence' has two 'c's and two 'r's.",
  },
  {
    pattern: /\bseperate\b/gi,
    replacement: "separate",
    type: "spelling",
    explanation: "'separate' has an 'a' after 'sep', not an 'e'.",
  },
  {
    pattern: /\bcalender\b/gi,
    replacement: "calendar",
    type: "spelling",
    explanation: "'calendar' ends with '-ar', not '-er'.",
  },
  {
    pattern: /\btommorow\b/gi,
    replacement: "tomorrow",
    type: "spelling",
    explanation: "'tomorrow' has one 'm', two 'r's.",
  },
  {
    pattern: /\bbegining\b/gi,
    replacement: "beginning",
    type: "spelling",
    explanation: "'beginning' has double 'n'.",
  },
  {
    pattern: /\bembarras\b/gi,
    replacement: "embarrass",
    type: "spelling",
    explanation: "'embarrass' has double 'r' and double 's'.",
  },
  {
    pattern: /\baccomodate\b/gi,
    replacement: "accommodate",
    type: "spelling",
    explanation: "'accommodate' has double 'c' and double 'm'.",
  },
  {
    pattern: /\bwich\b(?!\s+one)/gi,
    replacement: "which",
    type: "spelling",
    explanation: "'which' is the correct spelling.",
  },
  {
    pattern: /\bthier\b/gi,
    replacement: "their",
    type: "spelling",
    explanation: "'their' is the possessive form.",
  },
  {
    pattern: /\balot\b/gi,
    replacement: "a lot",
    type: "spelling",
    explanation: "'a lot' is two words.",
  },
  {
    pattern:
      /\bthere\s+(going|coming|doing|making|getting|having|working|taking|bringing|leaving|heading|arriving|planning|trying|looking|waiting|checking|reviewing|sending|preparing|meeting|starting|finishing|leading|running|building|creating|setting)\b/gi,
    replacement: "they're $1",
    type: "spelling",
    explanation: "Use 'they're' as a contraction of 'they are' before a verb.",
  },
  {
    pattern:
      /\btheir\s+(ready|done|finished|late|early|here|there|back|not|also|still|already|always|never|just|only|even|all|both|each|going|coming|working|happy|sorry|thankful|grateful|aware|concerned|interested)\b/gi,
    replacement: "they're $1",
    type: "spelling",
    explanation: "Use 'they're' (they are) instead of 'their' (possessive) before a description.",
  },
  {
    pattern: /\bcould of\b/gi,
    replacement: "could have",
    type: "grammar",
    explanation: "Use 'could have' instead of 'could of'.",
  },
  {
    pattern: /\bshould of\b/gi,
    replacement: "should have",
    type: "grammar",
    explanation: "Use 'should have' instead of 'should of'.",
  },
  {
    pattern: /\bwould of\b/gi,
    replacement: "would have",
    type: "grammar",
    explanation: "Use 'would have' instead of 'would of'.",
  },
  {
    pattern: /\bmight of\b/gi,
    replacement: "might have",
    type: "grammar",
    explanation: "Use 'might have' instead of 'might of'.",
  },
  {
    pattern:
      /\bless\s+(people|users|customers|employees|members|students|patients|participants|applicants|attendees)\b/gi,
    replacement: "fewer",
    type: "grammar",
    explanation: "Use 'fewer' for countable items.",
  },
];

const CAPITALIZATION_RULES: ReplacementRule[] = [
  {
    pattern: /\bi\b/g,
    replacement: "I",
    type: "capitalization",
    explanation: "'I' should always be capitalized.",
  },
];

const PUNCTUATION_RULES: ReplacementRule[] = [
  {
    pattern: /  +/g,
    replacement: " ",
    type: "punctuation",
    explanation: "Remove extra whitespace between words.",
  },
  {
    pattern: /\s+,/g,
    replacement: ",",
    type: "punctuation",
    explanation: "Remove space before comma.",
  },
  {
    pattern: /\s+\./g,
    replacement: ".",
    type: "punctuation",
    explanation: "Remove space before period.",
  },
  {
    pattern: /\s+\?/g,
    replacement: "?",
    type: "punctuation",
    explanation: "Remove space before question mark.",
  },
  {
    pattern: /\s+!/g,
    replacement: "!",
    type: "punctuation",
    explanation: "Remove space before exclamation mark.",
  },
  {
    pattern: /\.{2,}(?!\.)/g,
    replacement: ".",
    type: "punctuation",
    explanation: "Replace multiple periods with a single period.",
  },
];

const REDUNDANCY_RULES: ReplacementRule[] = [
  {
    pattern: /\bjust\b/gi,
    replacement: "",
    type: "redundancy",
    explanation: "'just' can often be removed for conciseness.",
  },
  {
    pattern: /\breally\b/gi,
    replacement: "",
    type: "redundancy",
    explanation: "'really' can often be removed for conciseness.",
  },
  {
    pattern: /\bvery\b/gi,
    replacement: "",
    type: "redundancy",
    explanation: "'very' can often be removed for conciseness.",
  },
  {
    pattern: /\bbasically\b/gi,
    replacement: "",
    type: "redundancy",
    explanation: "'basically' can often be removed for conciseness.",
  },
  {
    pattern: /\bactually\b/gi,
    replacement: "",
    type: "redundancy",
    explanation: "'actually' can often be removed for conciseness.",
  },
];

function applyRuleAndTrack(
  text: string,
  rule: ReplacementRule,
  offset: number,
): { text: string; issues: GrammarIssue[] } {
  const issues: GrammarIssue[] = [];
  let match: RegExpExecArray | null;
  const globalPattern = new RegExp(
    rule.pattern.source,
    rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g",
  );
  let result = text;

  while ((match = globalPattern.exec(result)) !== null) {
    const original = match[0];
    const start = offset + match.index;
    const end = start + original.length;
    const suggestion = original.replace(rule.pattern, rule.replacement);

    if (original !== suggestion) {
      issues.push({
        type: rule.type,
        location: { start, end },
        original,
        suggestion,
        explanation: rule.explanation,
      });
    }
  }

  result = result.replace(rule.pattern, rule.replacement);

  return { text: result, issues };
}

function fixSentenceCapitalization(text: string): { text: string; issues: GrammarIssue[] } {
  const issues: GrammarIssue[] = [];
  let result = text;

  result = result.replace(/(^|[.!?]\s+)([a-z])/g, (_match, before, letter) => {
    const start = text.indexOf(before + letter);
    const original = before + letter;
    const suggestion = before + letter.toUpperCase();
    if (letter !== letter.toUpperCase()) {
      issues.push({
        type: "capitalization",
        location: { start, end: start + original.length },
        original,
        suggestion,
        explanation: "Sentences should start with a capital letter.",
      });
    }
    return before + letter.toUpperCase();
  });

  return { text: result, issues };
}

function isGrammarInput(value: unknown): value is GrammarInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.bodyText === "string";
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function cleanGrammar(input: GrammarInput): GrammarResultStatus {
  if (!isGrammarInput(input)) {
    return {
      status: "error",
      code: "unsupported-input",
      message: "Expected input with a bodyText string field.",
    };
  }

  const body = input.bodyText.trim();
  if (body.length === 0) {
    return {
      status: "error",
      code: "empty-body",
      message: "Cannot clean an empty text body.",
    };
  }

  const originalText = normalizeWhitespace(body);
  const allIssues: GrammarIssue[] = [];
  let currentText = originalText;

  const applyRules = (rules: ReplacementRule[]) => {
    for (const rule of rules) {
      const fixed = applyRuleAndTrack(currentText, rule, 0);
      allIssues.push(...fixed.issues);
      currentText = fixed.text;
    }
  };

  applyRules(HOMOPHONE_RULES);
  applyRules(CAPITALIZATION_RULES);

  const capped = fixSentenceCapitalization(currentText);
  allIssues.push(...capped.issues);
  currentText = capped.text;

  applyRules(PUNCTUATION_RULES);
  applyRules(REDUNDANCY_RULES);

  currentText = normalizeWhitespace(currentText);

  const changed = currentText !== originalText;

  return {
    status: "ok",
    result: {
      originalText,
      correctedText: currentText,
      issues: allIssues,
      issueCount: allIssues.length,
      changed,
    },
  };
}

export function toReadyState(result: GrammarResultStatus): GrammarState {
  if (result.status === "error") {
    return { status: "error", code: result.code, message: result.message };
  }
  return { status: "ready", result: result.result };
}
