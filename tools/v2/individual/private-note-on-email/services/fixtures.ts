import type {
  PrivateNoteAttachmentInput,
  PrivateNoteAttachmentOptions,
  PrivateNoteErrorCode,
} from "../types/privateNoteOnEmail";

export interface PrivateNoteSuccessFixture {
  name: string;
  description: string;
  input: PrivateNoteAttachmentInput;
  options?: PrivateNoteAttachmentOptions;
  expected: {
    cleanNoteText: string;
    importance: string;
    visibility: string;
    tagsContains?: string[];
    hasReminder: boolean;
  };
}

export interface PrivateNoteFailureFixture {
  name: string;
  description: string;
  input: unknown;
  options?: unknown;
  expectedErrorCode: PrivateNoteErrorCode;
}

export const successFixtures: PrivateNoteSuccessFixture[] = [
  {
    name: "basic_note",
    description: "Attaches a simple text note to an email with default settings",
    input: {
      requestId: "req_basic_001",
      emailId: "msg_1001",
      emailSubject: "Project Update Q3",
      emailSender: "alice@example.com",
      noteText: "Discuss budget allocation during tomorrow's sync.",
    },
    expected: {
      cleanNoteText: "Discuss budget allocation during tomorrow's sync.",
      importance: "medium",
      visibility: "private",
      hasReminder: false,
    },
  },
  {
    name: "urgent_confidential_note_with_reminder",
    description: "Attaches an urgent confidential note with custom tags and a reminder",
    input: {
      requestId: "req_urgent_002",
      emailId: "msg_1002",
      emailSubject: "Quarterly Audit Confidential",
      emailSender: "cfo@example.com",
      noteText: "Review financial disclosures before board presentation.",
      importance: "urgent",
      visibility: "confidential",
      tags: ["finance", "audit"],
      reminderAt: "2026-08-01T09:00:00.000Z",
    },
    options: {
      autoTagKeywords: true,
    },
    expected: {
      cleanNoteText: "Review financial disclosures before board presentation.",
      importance: "urgent",
      visibility: "confidential",
      tagsContains: ["finance", "audit", "review"],
      hasReminder: true,
    },
  },
  {
    name: "html_sanitization_note",
    description: "Strips HTML tags and normalizes spacing in note text",
    input: {
      requestId: "req_html_003",
      emailId: "msg_1003",
      noteText: "<p>Important: <b>Verify invoice details</b> before sending payment!</p>",
      emailSubject: "Invoice #9920",
    },
    options: {
      stripHtml: true,
    },
    expected: {
      cleanNoteText: "Important: Verify invoice details before sending payment!",
      importance: "medium",
      visibility: "private",
      hasReminder: false,
    },
  },
  {
    name: "autotag_extraction_note",
    description: "Automatically extracts keyword tags when enabled",
    input: {
      requestId: "req_autotag_004",
      emailId: "msg_1004",
      noteText: "Urgent follow-up needed for contract approval meeting.",
    },
    options: {
      autoTagKeywords: true,
    },
    expected: {
      cleanNoteText: "Urgent follow-up needed for contract approval meeting.",
      importance: "medium",
      visibility: "private",
      tagsContains: ["urgent", "followup", "approval", "meeting"],
      hasReminder: false,
    },
  },
];

export const failureFixtures: PrivateNoteFailureFixture[] = [
  {
    name: "invalid_input_missing_required_fields",
    description: "Fails validation when requestId or emailId is missing",
    input: {
      noteText: "Orphan note without email ID",
    },
    expectedErrorCode: "invalid-input",
  },
  {
    name: "invalid_input_wrong_field_types",
    description: "Fails validation when noteText is not a string or importance is invalid",
    input: {
      requestId: "req_fail_002",
      emailId: "msg_2002",
      noteText: 12345,
      importance: "super-critical",
    },
    expectedErrorCode: "invalid-input",
  },
  {
    name: "invalid_options_out_of_bounds",
    description: "Fails validation when maxNoteLength option is non-integer or negative",
    input: {
      requestId: "req_fail_003",
      emailId: "msg_2003",
      noteText: "Valid note text",
    },
    options: {
      maxNoteLength: -10,
    },
    expectedErrorCode: "invalid-options",
  },
  {
    name: "empty_note_text",
    description: "Fails limit check when noteText is whitespace-only",
    input: {
      requestId: "req_fail_004",
      emailId: "msg_2004",
      noteText: "   \n\t  ",
    },
    expectedErrorCode: "empty-note",
  },
  {
    name: "note_too_long",
    description: "Fails limit check when noteText exceeds specified maxNoteLength limit",
    input: {
      requestId: "req_fail_005",
      emailId: "msg_2005",
      noteText: "This note text exceeds the small length limit set in options.",
    },
    options: {
      maxNoteLength: 20,
    },
    expectedErrorCode: "note-too-long",
  },
  {
    name: "too_many_tags",
    description: "Fails limit check when tags array count exceeds maxTags option limit",
    input: {
      requestId: "req_fail_006",
      emailId: "msg_2006",
      noteText: "Note with too many tags",
      tags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
    },
    options: {
      maxTags: 3,
    },
    expectedErrorCode: "too-many-tags",
  },
];
