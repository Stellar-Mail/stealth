/**
 * Team Task Board from Emails - Main Entry Point
 *
 * Export all validation, sanitization, and guard helpers
 */

// Validation
export { EmailValidator } from "./validation/email-validator";
export { AttachmentValidator } from "./validation/attachment-validator";

// Sanitization
export { ContentSanitizer } from "./sanitization/content-sanitizer";

// Guards
export { PerformanceGuard, TimeoutGuardImpl, MemoryMonitor } from "./guards/performance-guard";

// Types
export type {
  EmailInput,
  EmailAttachment,
  EmailThread,
  TaskPriority,
  TaskStatus,
  BoardCard,
  TaskBoard,
  ValidationResult,
  ValidationError,
  ValidationRules,
  SanitizationResult,
  SanitizationOptions,
  PerformanceMetrics,
  PerformanceLimits,
  TimeoutGuard,
  ParseResult,
  ParseError,
  GuardResult,
  GuardType,
  ResourceUsage,
  ThreatCategory,
  ThreatDetection,
  SecurityLogEntry,
  LogLevel,
  ToolConfig,
} from "./types";
