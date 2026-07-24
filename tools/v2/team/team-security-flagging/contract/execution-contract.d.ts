/** Typed backend contract for the presentation-independent security flagging service. */
export type SecurityFlagSeverity = "critical" | "high" | "medium" | "low";
export type SecurityFlagCategory =
  | "phishing"
  | "credential-theft"
  | "malware"
  | "data-breach"
  | "suspicious-sender"
  | "unauthorized-access"
  | "social-engineering"
  | "other";

export interface SecurityFlaggingInput {
  emailId: string;
  threadId: string;
  reportedBy: string;
  severity: SecurityFlagSeverity;
  category: SecurityFlagCategory;
  subject: string;
  senderEmail: string;
  description: string;
  evidence?: readonly string[];
}

export interface SecurityFlaggingRecord extends SecurityFlaggingInput {
  id: string;
  status: "new";
  evidence: readonly string[];
  createdAt: string;
  updatedAt: string;
}

/** Stable codes callers may branch on. Error messages are not stable. */
export type SecurityFlaggingErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED_REPORTER"
  | "DUPLICATE_FLAG"
  | "PERSISTENCE_FAILED"
  | "INTERNAL_ERROR";

export interface SecurityFlaggingError {
  code: SecurityFlaggingErrorCode;
  message: string;
  field?: string;
  existingFlagId?: string;
}

export type SecurityFlaggingOutput =
  | { ok: true; data: SecurityFlaggingRecord }
  | { ok: false; error: SecurityFlaggingError };

/** I/O and environmental behavior supplied by the backend caller. */
export interface SecurityFlaggingDependencies {
  authorizeReporter(reporterEmail: string): boolean | Promise<boolean>;
  findActiveFlag(input: {
    emailId: string;
    threadId: string;
  }): string | null | Promise<string | null>;
  persistFlag(record: SecurityFlaggingRecord): void | Promise<void>;
  generateId(): string;
  now(): Date;
}

export interface SecurityFlaggingExecutor {
  execute(input: SecurityFlaggingInput): Promise<SecurityFlaggingOutput>;
}
