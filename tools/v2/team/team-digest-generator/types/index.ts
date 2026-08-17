// TypeScript type definitions for Team Digest Generator

/**
 * Digest configuration for a team
 */
export interface DigestConfig {
  teamId: string;
  recipients: TeamMember[];
  schedule: ScheduleExpression;
  filters: DigestFilters;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team member in digest recipient list
 */
export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role?: string;
}

/**
 * Schedule expression (cron or simple)
 */
export interface ScheduleExpression {
  type: "daily" | "weekly" | "cron";
  value: string; // ISO time or cron expression
  timezone?: string;
}

/**
 * Digest content filters
 */
export interface DigestFilters {
  excludeSenders?: string[];
  excludeCategories?: string[];
  minImportance?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Email for digest
 */
export interface DigestEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  timestamp: Date;
  importance: number;
  hasAttachments: boolean;
}

/**
 * Generated digest
 */
export interface GeneratedDigest {
  id: string;
  teamId: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  emails: DigestEmail[];
  summary: string;
  recipientCount: number;
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}
