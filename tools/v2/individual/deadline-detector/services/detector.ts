import { sanitizeEmailInput, validateBatchInput } from '../security/guards';

export interface EmailPayload {
  id: string;
  subject?: string;
  body: string;
  receivedAt?: string;
}

export interface DetectedDeadline {
  emailId: string;
  rawText: string;
  dueDate: string | null;
  confidence: 'high' | 'medium' | 'low';
}

// Fast pre-filter keywords to avoid unnecessary heavy regex parsing
const TEMPORAL_KEYWORDS = [
  'due', 'deadline', 'by', 'until', 'eod', 'eow', 
  'asap', 'submit', 'deliver', 'complete', 'before'
];

/**
 * Performance-hardened deadline detector execution.
 */
export function detectDeadlines(rawEmails: EmailPayload[]): DetectedDeadline[] {
  const safeEmails = validateBatchInput(rawEmails);
  const results: DetectedDeadline[] = [];

  for (const email of safeEmails) {
    const cleanBody = sanitizeEmailInput(email.body);
    const cleanSubject = sanitizeEmailInput(email.subject || '');
    const combinedText = `${cleanSubject} ${cleanBody}`.toLowerCase();

    // Performance Optimization: Early exit if no temporal keywords exist
    const hasTemporalContext = TEMPORAL_KEYWORDS.some(kw => combinedText.includes(kw));
    if (!hasTemporalContext) continue;

    // Execute safe extraction logic on sanitized input
    const foundDeadlines = extractDatePatterns(email.id, cleanBody);
    results.push(...foundDeadlines);
  }

  return results;
}

function extractDatePatterns(emailId: string, text: string): DetectedDeadline[] {
  // ReDoS-safe simple regex patterns or localized date parser call
  const datePattern = /\b(?:due|by|before)\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/gi;
  const matches: DetectedDeadline[] = [];
  let match: RegExpExecArray | null;

  while ((match = datePattern.exec(text)) !== null) {
    matches.push({
      emailId,
      rawText: match[0],
      dueDate: match[1] || null,
      confidence: 'medium',
    });

    // Safety guard against infinite loops in regex matching
    if (matches.length >= 10) break;
  }

  return matches;
}

