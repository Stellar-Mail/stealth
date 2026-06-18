/**
 * Team Task Board from Emails - Type Definitions
 *
 * Core types for email parsing, task extraction, and validation
 */

// ============================================================================
// Email Types
// ============================================================================

export interface EmailInput {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  receivedAt: string; // ISO 8601
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number; // bytes
  contentId?: string;
  url?: string;
}

export interface EmailThread {
  threadId: string;
  emails: EmailInput[];
  participantCount: number;
  messageCount: number;
  startDate: string;
  endDate: string;
}

// ============================================================================
// Task Board Types
// ============================================================================

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "new" | "triage" | "blocked" | "done";

export interface BoardCard {
  id: string;
  title: string;
  description?: string;
  owner: string; // Team member ID or "unassigned"
  dueDate: string | null; // ISO 8601 or null
  priority: TaskPriority;
  status: TaskStatus;
  sourceEmailId: string;
  sourceThreadId: string;
  reviewRequired: boolean;
  extractionConfidence: number; // 0-100
  createdAt: string; // ISO 8601
  metadata: {
    originalSubject: string;
    originalSnippet: string; // Max 500 chars
    extractedFrom: "subject" | "body" | "both";
  };
}

export interface TaskBoard {
  id: string;
  name: string;
  cards: BoardCard[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult<T = unknown> {
  isValid: boolean;
  value?: T;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean;
}

// ============================================================================
// Sanitization Types
// ============================================================================

export interface SanitizationResult {
  sanitized: string;
  removed: string[];
  modified: boolean;
}

export interface SanitizationOptions {
  stripHtml?: boolean;
  removeScripts?: boolean;
  removeUrls?: boolean;
  normalizeWhitespace?: boolean;
  maxLength?: number;
}

// ============================================================================
// Performance Types
// ============================================================================

export interface PerformanceMetrics {
  processingTimeMs: number;
  memoryUsedMb: number;
  emailsProcessed: number;
  validationErrors: number;
  sanitizationActions: number;
  tasksExtracted: number;
}

export interface PerformanceLimits {
  maxProcessingTimeMs: number;
  maxMemoryMb: number;
  maxEmailsPerBatch: number;
  maxThreadDepth: number;
  maxRegexSteps: number;
}

export interface TimeoutGuard {
  startTime: number;
  timeoutMs: number;
  isExpired: () => boolean;
  remainingMs: () => number;
}

// ============================================================================
// Parser Result Types
// ============================================================================

export interface ParseResult {
  success: boolean;
  tasks: BoardCard[];
  reviewRequired: boolean;
  metrics: PerformanceMetrics;
  error?: ParseError;
  warnings: string[];
}

export interface ParseError {
  code: string;
  message: string;
  emailId?: string;
  threadId?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Guard Types
// ============================================================================

export interface GuardResult<T = unknown> {
  allowed: boolean;
  value?: T;
  reason?: string;
  guardType: GuardType;
}

export type GuardType = "size" | "time" | "memory" | "depth" | "complexity" | "rate" | "content";

export interface ResourceUsage {
  memory: number; // bytes
  time: number; // milliseconds
  depth: number; // nesting level
  operations: number; // count
}

// ============================================================================
// Threat Model Types
// ============================================================================

export type ThreatCategory =
  | "xss"
  | "injection"
  | "dos"
  | "redos"
  | "zip-bomb"
  | "memory-exhaustion"
  | "stack-overflow"
  | "spoofing"
  | "malformed-input";

export interface ThreatDetection {
  category: ThreatCategory;
  severity: "low" | "medium" | "high" | "critical";
  detected: boolean;
  description: string;
  mitigated: boolean;
  mitigation?: string;
}

// ============================================================================
// Logging Types
// ============================================================================

export interface SecurityLogEntry {
  timestamp: string;
  event: string;
  severity: "info" | "warning" | "error" | "critical";
  emailId?: string;
  threadId?: string;
  details: Record<string, unknown>;
  redacted: boolean;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

// ============================================================================
// Configuration Types
// ============================================================================

export interface ToolConfig {
  validation: {
    strictMode: boolean;
    maxEmailSize: number;
    maxAttachmentSize: number;
    maxThreadSize: number;
  };
  performance: {
    timeoutPerEmail: number;
    timeoutPerThread: number;
    maxMemoryPerEmail: number;
    maxBatchSize: number;
  };
  security: {
    enableSanitization: boolean;
    blockExecutables: boolean;
    logSecurityEvents: boolean;
  };
}
