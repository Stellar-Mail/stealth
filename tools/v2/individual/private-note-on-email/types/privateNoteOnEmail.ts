export type PrivateNoteImportance = "low" | "medium" | "high" | "urgent";

export type PrivateNoteVisibility = "private" | "shared_with_team" | "confidential";

export interface PrivateNoteAttachmentInput {
  requestId: string;
  emailId: string;
  emailSubject?: string;
  emailSender?: string;
  noteText: string;
  importance?: PrivateNoteImportance;
  visibility?: PrivateNoteVisibility;
  tags?: string[];
  reminderAt?: string;
}

export interface PrivateNoteAttachmentOptions {
  maxNoteLength?: number;
  maxTags?: number;
  autoTagKeywords?: boolean;
  stripHtml?: boolean;
}

export interface PrivateNoteMetadata {
  emailSubjectSnippet: string | null;
  emailSender: string | null;
  autoTagged: boolean;
}

export interface PrivateNoteAttachmentOutput {
  requestId: string;
  emailId: string;
  noteId: string;
  cleanNoteText: string;
  importance: PrivateNoteImportance;
  visibility: PrivateNoteVisibility;
  tags: string[];
  characterCount: number;
  wordCount: number;
  createdAt: string;
  reminderAt: string | null;
  metadata: PrivateNoteMetadata;
}

export type PrivateNoteErrorCode =
  | "invalid-input"
  | "invalid-options"
  | "note-too-long"
  | "too-many-tags"
  | "empty-note";

export interface PrivateNoteValidationIssue {
  field: string;
  message: string;
}

export type SafePrivateNoteResult =
  | {
      status: "ok";
      result: PrivateNoteAttachmentOutput;
    }
  | {
      status: "error";
      code: PrivateNoteErrorCode;
      message: string;
      issues: PrivateNoteValidationIssue[];
    };
