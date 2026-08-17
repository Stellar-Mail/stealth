/**
 * PDF Summary Tool - Utility Fixtures
 *
 * Test data for execution contract and text analysis utilities.
 * Covers success and failure cases.
 */

import type {
  SummarizePdfPayload,
  ValidatePdfPayload,
  GetSummaryPayload,
  DeleteSummaryPayload,
} from "../types/execution";

// ---------------------------------------------------------------------------
// Text Fixtures
// ---------------------------------------------------------------------------

/** Short text (minimal - near edge of minimum length). */
export const MINIMAL_TEXT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";

/** Medium-length text suitable for summarization. */
export const SAMPLE_PDF_TEXT = `The Internet has fundamentally transformed how we communicate and share information. 
From the early days of dial-up connections to today's high-speed fiber networks, 
the evolution of web technology has been remarkable. Social media platforms have 
connected billions of people across the globe. Email remains one of the most 
reliable forms of digital communication. Video streaming services have changed 
how we consume entertainment. Cloud computing has revolutionized data storage 
and processing. Artificial intelligence is increasingly integrated into everyday 
applications. Cybersecurity has become critical as digital threats continue to 
evolve. The future of the Internet promises even more innovation and change.`;

/** Long text with multiple paragraphs. */
export const LONG_TEXT = `Paragraph 1: The Industrial Revolution marked a turning point in human history, 
transforming agrarian societies into industrial powerhouses. Steam engines powered factories, 
mechanized production increased output dramatically, and urbanization accelerated as people 
moved to cities for factory work. This period saw rapid technological advancement and 
significant social upheaval.

Paragraph 2: The subsequent technological revolutions—electricity, computing, and the Internet—
each brought their own transformations. The electric revolution powered homes and cities, 
enabling mass production and improved quality of life. The computing revolution created 
entirely new industries and ways of working. The Internet revolution connected the world 
and democratized access to information.

Paragraph 3: Looking forward, the next technological shift will likely center on renewable energy, 
advanced artificial intelligence, and biotechnology. These technologies promise solutions to 
pressing global challenges like climate change, disease, and food security. However, they also 
raise important questions about equity, employment, and ethics that society must grapple with.`;

/** Text with multiple sentences but under minimum length. */
export const TOO_SHORT_TEXT = "This is too short.";

/** Text that is empty or whitespace only. */
export const EMPTY_TEXT = "   ";

// ---------------------------------------------------------------------------
// Execution Contract Payloads - Success Cases
// ---------------------------------------------------------------------------

export const VALID_SUMMARIZE_PAYLOAD: SummarizePdfPayload = {
  pdfContent: SAMPLE_PDF_TEXT,
  fileName: "example.pdf",
  fileSizeBytes: 50000,
  settings: {
    length: "medium",
    style: "paragraph",
    includeKeywords: true,
    language: "en",
  },
};

export const VALID_SUMMARIZE_PAYLOAD_MINIMAL: SummarizePdfPayload = {
  pdfContent: MINIMAL_TEXT,
  fileName: "minimal.pdf",
  fileSizeBytes: 1000,
};

export const VALID_VALIDATE_PAYLOAD: ValidatePdfPayload = {
  fileName: "document.pdf",
  fileSizeBytes: 1024 * 1024, // 1 MB
  mimeType: "application/pdf",
};

export const VALID_GET_SUMMARY_PAYLOAD: GetSummaryPayload = {
  summaryId: "summary-12345",
};

export const VALID_DELETE_SUMMARY_PAYLOAD: DeleteSummaryPayload = {
  summaryId: "summary-12345",
};

// ---------------------------------------------------------------------------
// Execution Contract Payloads - Failure Cases
// ---------------------------------------------------------------------------

/** Missing pdfContent. */
export const INVALID_SUMMARIZE_MISSING_CONTENT = {
  fileName: "example.pdf",
  fileSizeBytes: 50000,
};

/** Empty pdfContent string. */
export const INVALID_SUMMARIZE_EMPTY_CONTENT: Partial<SummarizePdfPayload> = {
  pdfContent: "   ",
  fileName: "example.pdf",
  fileSizeBytes: 50000,
};

/** Missing fileName. */
export const INVALID_SUMMARIZE_MISSING_FILENAME: Partial<SummarizePdfPayload> = {
  pdfContent: SAMPLE_PDF_TEXT,
  fileSizeBytes: 50000,
};

/** Negative fileSizeBytes. */
export const INVALID_SUMMARIZE_NEGATIVE_SIZE: Partial<SummarizePdfPayload> = {
  pdfContent: SAMPLE_PDF_TEXT,
  fileName: "example.pdf",
  fileSizeBytes: -100,
};

/** Missing mimeType. */
export const INVALID_VALIDATE_MISSING_MIME: Partial<ValidatePdfPayload> = {
  fileName: "document.pdf",
  fileSizeBytes: 1024 * 1024,
};

/** Invalid MIME type. */
export const INVALID_VALIDATE_UNSUPPORTED_MIME: ValidatePdfPayload = {
  fileName: "document.txt",
  fileSizeBytes: 1024 * 1024,
  mimeType: "text/plain",
};

/** File size exceeds maximum (50 MB + 1 byte). */
export const INVALID_VALIDATE_FILE_TOO_LARGE: ValidatePdfPayload = {
  fileName: "huge.pdf",
  fileSizeBytes: 50 * 1024 * 1024 + 1,
  mimeType: "application/pdf",
};

/** Empty summaryId. */
export const INVALID_GET_SUMMARY_EMPTY_ID: Partial<GetSummaryPayload> = {
  summaryId: "   ",
};

/** Missing summaryId. */
export const INVALID_GET_SUMMARY_MISSING_ID = {};

/** Empty delete payload. */
export const INVALID_DELETE_SUMMARY_EMPTY_ID: Partial<DeleteSummaryPayload> = {
  summaryId: "",
};

// ---------------------------------------------------------------------------
// Keyword Extraction Test Cases
// ---------------------------------------------------------------------------

export const KEYWORD_TEST_CASES = [
  {
    name: "simple English text",
    text: "The quick brown fox jumps over the lazy dog in the forest",
    expectedKeywords: ["quick", "brown", "fox"],
    limit: 3,
  },
  {
    name: "text with technical terms",
    text: "Machine learning algorithms enable computers to learn from data without explicit programming instructions",
    expectedKeywords: ["machine", "learning", "algorithms"],
    limit: 3,
  },
  {
    name: "empty text",
    text: "",
    expectedKeywords: [],
    limit: 5,
  },
  {
    name: "text with only stopwords",
    text: "the and or but in on at to for of",
    expectedKeywords: [],
    limit: 5,
  },
];

// ---------------------------------------------------------------------------
// Text Analysis Test Cases
// ---------------------------------------------------------------------------

export const TEXT_ANALYSIS_TEST_CASES = [
  {
    name: "short text",
    text: "Hello world.",
    wordCount: 2,
    sentenceCount: 1,
    readingTimeMinutes: 0,
  },
  {
    name: "medium text",
    text: SAMPLE_PDF_TEXT,
    wordCount: 59, // approximate
    sentenceCount: 10, // approximate
    readingTimeMinutes: 0,
  },
  {
    name: "long text",
    text: LONG_TEXT,
    wordCount: 250, // approximate
    sentenceCount: 20, // approximate
    readingTimeMinutes: 1,
  },
];

// ---------------------------------------------------------------------------
// Summary Result Fixtures - Type Examples
// ---------------------------------------------------------------------------

/**
 * Example summary structure (for reference in tests).
 * In actual tests, use vitest's expect() matchers to validate.
 */
export const EXAMPLE_SUMMARY_STRUCTURE = {
  id: "summary-12345",
  pdfId: "example.pdf",
  content: "This is a sample summary...",
  settings: {
    length: "medium" as const,
    style: "paragraph" as const,
    includeKeywords: true,
    language: "en",
  },
  generatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Error Scenario Fixtures
// ---------------------------------------------------------------------------

export const ERROR_SCENARIOS = [
  {
    name: "missing action",
    input: { payload: {} },
    expectedCode: "INVALID_INPUT",
  },
  {
    name: "unsupported action",
    input: { action: "UNKNOWN_ACTION", payload: {} },
    expectedCode: "ACTION_NOT_SUPPORTED",
  },
  {
    name: "content too short",
    input: {
      action: "SUMMARIZE_PDF",
      payload: {
        pdfContent: "Too short",
        fileName: "test.pdf",
        fileSizeBytes: 100,
      },
    },
    expectedCode: "CONTENT_TOO_SHORT",
  },
  {
    name: "file too large",
    input: {
      action: "VALIDATE_PDF",
      payload: {
        fileName: "huge.pdf",
        fileSizeBytes: 50 * 1024 * 1024 + 1,
        mimeType: "application/pdf",
      },
    },
    expectedCode: "FILE_TOO_LARGE",
  },
];
