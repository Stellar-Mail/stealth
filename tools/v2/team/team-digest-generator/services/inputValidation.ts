/* eslint-disable no-control-regex, no-useless-escape */
/**
 * Input validation service for Team Digest Generator
 * Handles validation of user input and configuration
 */

import {
  DigestConfig,
  DigestFilters,
  ScheduleExpression,
  TeamMember,
  ValidationError,
} from "../types";

/**
 * Validation error result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate email address format (RFC 5322 basic)
 */
export function validateEmail(email: string): ValidationError | null {
  const maxLength = 254;
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    return {
      field: "email",
      message: "Email is required",
      code: "REQUIRED",
    };
  }

  if (email.length > maxLength) {
    return {
      field: "email",
      message: `Email exceeds max length of ${maxLength} characters`,
      code: "MAX_LENGTH_EXCEEDED",
    };
  }

  const trimmedEmail = email.trim();
  if (!basicEmailRegex.test(trimmedEmail)) {
    return {
      field: "email",
      message: "Invalid email format",
      code: "INVALID_FORMAT",
    };
  }

  return null;
}

/**
 * Sanitize team member name - remove control characters and enforce length limits
 */
export function sanitizeTeamMemberName(name: string): string {
  if (!name) return "";

  // Remove control characters (U+0000-U+001F, U+007F-U+009F)
  let sanitized = name.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

  // Trim whitespace
  sanitized = sanitized.trim();

  // Enforce max length
  const maxLength = 200;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate team member object
 */
export function validateTeamMember(member: any): ValidationError | null {
  if (!member) {
    return {
      field: "teamMember",
      message: "Team member is required",
      code: "REQUIRED",
    };
  }

  const emailError = validateEmail(member.email);
  if (emailError) return emailError;

  if (!member.name || typeof member.name !== "string") {
    return {
      field: "name",
      message: "Team member name is required",
      code: "REQUIRED",
    };
  }

  if (member.name.length > 200) {
    return {
      field: "name",
      message: "Team member name exceeds max length of 200 characters",
      code: "MAX_LENGTH_EXCEEDED",
    };
  }

  return null;
}

/**
 * Validate cron expression (5-field format)
 * Prevents ReDoS by limiting field complexity
 */
export function validateCronExpression(cron: string): ValidationError | null {
  if (!cron || typeof cron !== "string") {
    return {
      field: "cron",
      message: "Cron expression is required",
      code: "REQUIRED",
    };
  }

  const parts = cron.trim().split(/\s+/);

  if (parts.length !== 5) {
    return {
      field: "cron",
      message: "Cron expression must have exactly 5 fields (minute hour day month weekday)",
      code: "INVALID_FIELD_COUNT",
    };
  }

  // Prevent ReDoS by checking field length
  const maxFieldLength = 50;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length > maxFieldLength) {
      return {
        field: "cron",
        message: `Cron field ${i} exceeds max complexity (max ${maxFieldLength} chars)`,
        code: "FIELD_TOO_COMPLEX",
      };
    }
  }

  // Validate each field
  const ranges = [
    { min: 0, max: 59, name: "minute" },
    { min: 0, max: 23, name: "hour" },
    { min: 1, max: 31, name: "day" },
    { min: 1, max: 12, name: "month" },
    { min: 0, max: 6, name: "weekday" },
  ];

  for (let i = 0; i < parts.length; i++) {
    const { min, max, name } = ranges[i];
    const fieldError = validateCronField(parts[i], min, max, name);
    if (fieldError) return fieldError;
  }

  return null;
}

/**
 * Validate a single cron field
 */
function validateCronField(
  field: string,
  min: number,
  max: number,
  name: string,
): ValidationError | null {
  if (field === "*") return null; // Wildcard is always valid

  // Handle ranges (0-5)
  if (field.includes("-")) {
    const parts = field.split("-");
    if (parts.length !== 2) {
      return {
        field: "cron",
        message: `Invalid ${name} range format`,
        code: "INVALID_RANGE",
      };
    }

    const start = parseInt(parts[0], 10);
    const end = parseInt(parts[1], 10);

    if (isNaN(start) || isNaN(end)) {
      return {
        field: "cron",
        message: `Invalid ${name} range values`,
        code: "INVALID_RANGE_VALUES",
      };
    }

    if (start < min || end > max || start > end) {
      return {
        field: "cron",
        message: `${name} range out of valid bounds (${min}-${max})`,
        code: "RANGE_OUT_OF_BOUNDS",
      };
    }

    return null;
  }

  // Handle comma-separated values (1,2,3)
  if (field.includes(",")) {
    const values = field.split(",");
    for (const val of values) {
      const num = parseInt(val.trim(), 10);
      if (isNaN(num) || num < min || num > max) {
        return {
          field: "cron",
          message: `Invalid ${name} value: ${val}`,
          code: "INVALID_VALUE",
        };
      }
    }
    return null;
  }

  // Handle step values (*/5, 0-30/5)
  if (field.includes("/")) {
    const [range, step] = field.split("/");
    const stepNum = parseInt(step, 10);

    if (isNaN(stepNum) || stepNum <= 0) {
      return {
        field: "cron",
        message: `Invalid ${name} step value`,
        code: "INVALID_STEP",
      };
    }

    // Range before step is optional (can be *)
    return null;
  }

  // Single numeric value
  const num = parseInt(field, 10);
  if (isNaN(num) || num < min || num > max) {
    return {
      field: "cron",
      message: `Invalid ${name} value: must be between ${min} and ${max}`,
      code: "VALUE_OUT_OF_BOUNDS",
    };
  }

  return null;
}

/**
 * Validate schedule expression
 */
export function validateScheduleExpression(schedule: any): ValidationError | null {
  if (!schedule) {
    return {
      field: "schedule",
      message: "Schedule expression is required",
      code: "REQUIRED",
    };
  }

  const { type, value, timezone } = schedule;

  if (!type || !["daily", "weekly", "cron"].includes(type)) {
    return {
      field: "schedule.type",
      message: "Schedule type must be one of: daily, weekly, cron",
      code: "INVALID_TYPE",
    };
  }

  if (!value || typeof value !== "string") {
    return {
      field: "schedule.value",
      message: "Schedule value is required",
      code: "REQUIRED",
    };
  }

  if (type === "daily") {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(value.trim())) {
      return {
        field: "schedule.value",
        message: "Daily schedule must be in HH:MM format (00:00-23:59)",
        code: "INVALID_TIME_FORMAT",
      };
    }
  } else if (type === "weekly") {
    const weeklyRegex = /^[0-6]\s([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!weeklyRegex.test(value.trim())) {
      return {
        field: "schedule.value",
        message: 'Weekly schedule must be in format "D HH:MM" where D is 0-6 (Sunday-Saturday)',
        code: "INVALID_WEEKLY_FORMAT",
      };
    }
  } else if (type === "cron") {
    const cronError = validateCronExpression(value);
    if (cronError) return cronError;
  }

  if (timezone && typeof timezone === "string") {
    if (!isValidTimezone(timezone)) {
      return {
        field: "schedule.timezone",
        message: `Invalid timezone: ${timezone}`,
        code: "INVALID_TIMEZONE",
      };
    }
  }

  return null;
}

/**
 * Check if timezone is valid IANA timezone
 */
export function isValidTimezone(tz: string): boolean {
  // Basic check for common timezones
  const commonZones = new Set([
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Singapore",
    "Australia/Sydney",
    "Pacific/Auckland",
  ]);

  if (commonZones.has(tz)) return true;

  // In production, use proper IANA timezone validation library
  // For now, accept if it looks reasonable
  return /^[A-Z][a-zA-Z0-9_/\-]*$/.test(tz) && tz.length < 50;
}

/**
 * Validate filter rules - email exclusions, category exclusions, etc.
 */
export function validateFilterRules(filters: any): ValidationError | null {
  if (!filters) {
    return null; // Filters are optional
  }

  // Check exclude senders
  if (filters.excludeSenders) {
    if (!Array.isArray(filters.excludeSenders)) {
      return {
        field: "filters.excludeSenders",
        message: "Exclude senders must be an array",
        code: "INVALID_TYPE",
      };
    }

    if (filters.excludeSenders.length > 1000) {
      return {
        field: "filters.excludeSenders",
        message: "Too many exclusion rules (max 1000)",
        code: "TOO_MANY_RULES",
      };
    }

    for (let i = 0; i < filters.excludeSenders.length; i++) {
      const sender = filters.excludeSenders[i];

      if (typeof sender !== "string") {
        return {
          field: "filters.excludeSenders",
          message: `Exclude sender at index ${i} must be a string`,
          code: "INVALID_TYPE",
        };
      }

      if (sender.length > 500) {
        return {
          field: "filters.excludeSenders",
          message: `Exclude sender at index ${i} exceeds max length (max 500)`,
          code: "RULE_TOO_LONG",
        };
      }

      const emailError = validateEmail(sender);
      if (emailError) {
        return {
          ...emailError,
          field: `filters.excludeSenders[${i}]`,
        };
      }
    }
  }

  // Check exclude categories
  if (filters.excludeCategories) {
    if (!Array.isArray(filters.excludeCategories)) {
      return {
        field: "filters.excludeCategories",
        message: "Exclude categories must be an array",
        code: "INVALID_TYPE",
      };
    }

    if (filters.excludeCategories.length > 100) {
      return {
        field: "filters.excludeCategories",
        message: "Too many category exclusions (max 100)",
        code: "TOO_MANY_CATEGORIES",
      };
    }

    for (let i = 0; i < filters.excludeCategories.length; i++) {
      const cat = filters.excludeCategories[i];
      if (typeof cat !== "string" || cat.length === 0 || cat.length > 50) {
        return {
          field: "filters.excludeCategories",
          message: `Category at index ${i} invalid (must be 1-50 characters)`,
          code: "INVALID_CATEGORY",
        };
      }
    }
  }

  // Check min importance
  if (filters.minImportance !== undefined) {
    const importance = parseInt(filters.minImportance, 10);
    if (isNaN(importance) || importance < 0 || importance > 10) {
      return {
        field: "filters.minImportance",
        message: "Min importance must be a number between 0 and 10",
        code: "INVALID_VALUE",
      };
    }
  }

  return null;
}

/**
 * Validate digest configuration
 */
export function validateDigestConfig(config: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!config) {
    return {
      valid: false,
      errors: [
        {
          field: "config",
          message: "Configuration is required",
          code: "REQUIRED",
        },
      ],
    };
  }

  // Validate team ID
  if (!config.teamId || typeof config.teamId !== "string") {
    errors.push({
      field: "teamId",
      message: "Team ID is required",
      code: "REQUIRED",
    });
  }

  // Validate recipients
  if (!Array.isArray(config.recipients)) {
    errors.push({
      field: "recipients",
      message: "Recipients must be an array",
      code: "INVALID_TYPE",
    });
  } else {
    if (config.recipients.length === 0) {
      errors.push({
        field: "recipients",
        message: "At least one recipient is required",
        code: "EMPTY_ARRAY",
      });
    }

    if (config.recipients.length > 1000) {
      errors.push({
        field: "recipients",
        message: "Too many recipients (max 1000)",
        code: "TOO_MANY_RECIPIENTS",
      });
    }

    for (let i = 0; i < config.recipients.length; i++) {
      const memberError = validateTeamMember(config.recipients[i]);
      if (memberError) {
        errors.push({
          ...memberError,
          field: `recipients[${i}].${memberError.field}`,
        });
      }
    }

    // Check for duplicates
    const emails = new Set<string>();
    for (const recipient of config.recipients) {
      if (emails.has(recipient.email)) {
        errors.push({
          field: "recipients",
          message: `Duplicate recipient: ${recipient.email}`,
          code: "DUPLICATE_RECIPIENT",
        });
      }
      emails.add(recipient.email);
    }
  }

  // Validate schedule
  const scheduleError = validateScheduleExpression(config.schedule);
  if (scheduleError) {
    errors.push(scheduleError);
  }

  // Validate filters
  const filterError = validateFilterRules(config.filters);
  if (filterError) {
    errors.push(filterError);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
