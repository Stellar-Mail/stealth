import { ValidationError, ValidationResult } from "../types";

/**
 * Basic RFC 5322 email regex to validate inputs without ReDoS vulnerabilities
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validate email format and length
 */
export function validateEmail(email: string): ValidationError | null {
  if (!email) {
    return {
      field: "email",
      message: "Email address is required",
      code: "REQUIRED",
    };
  }

  const maxLength = 254;
  if (email.length > maxLength) {
    return {
      field: "email",
      message: `Email length exceeds maximum allowed (${maxLength} characters)`,
      code: "MAX_LENGTH_EXCEEDED",
    };
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    return {
      field: "email",
      message: "Invalid email format",
      code: "INVALID_FORMAT",
    };
  }

  return null;
}

/**
 * Validate date ISO string
 */
export function validateDate(dateStr: string, fieldName: string): ValidationError | null {
  if (!dateStr) {
    return {
      field: fieldName,
      message: `${fieldName} date is required`,
      code: "REQUIRED",
    };
  }

  // Basic check for ISO-like length to prevent ReDoS on Date parsing
  if (dateStr.length > 50) {
    return {
      field: fieldName,
      message: `Date string too long`,
      code: "INVALID_FORMAT",
    };
  }

  const timestamp = Date.parse(dateStr);
  if (isNaN(timestamp)) {
    return {
      field: fieldName,
      message: `Invalid ISO date format: ${dateStr}`,
      code: "INVALID_FORMAT",
    };
  }

  return null;
}

/**
 * Validate event times
 */
export function validateEventTimes(startDate: string, endDate: string): ValidationError | null {
  const startErr = validateDate(startDate, "startDate");
  if (startErr) return startErr;

  const endErr = validateDate(endDate, "endDate");
  if (endErr) return endErr;

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  if (startMs > endMs) {
    return {
      field: "endDate",
      message: "End date cannot be before start date",
      code: "INVALID_TIMEFRAME",
    };
  }

  return null;
}

/**
 * Validate full extracted calendar event object
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function validateCalendarEvent(event: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate Title
  if (!event.title || typeof event.title !== "string" || event.title.trim() === "") {
    errors.push({
      field: "title",
      message: "Title is required",
      code: "REQUIRED",
    });
  } else if (event.title.length > 200) {
    errors.push({
      field: "title",
      message: "Title exceeds max length of 200 characters",
      code: "MAX_LENGTH_EXCEEDED",
    });
  }

  // Validate Organizer
  if (event.organizer) {
    // Organizer can be name or email, if email validate it
    if (event.organizer.includes("@")) {
      const emailErr = validateEmail(event.organizer);
      if (emailErr) {
        errors.push({
          ...emailErr,
          field: "organizer",
        });
      }
    } else if (event.organizer.length > 200) {
      errors.push({
        field: "organizer",
        message: "Organizer name exceeds max length of 200 characters",
        code: "MAX_LENGTH_EXCEEDED",
      });
    }
  } else {
    errors.push({
      field: "organizer",
      message: "Organizer is required",
      code: "REQUIRED",
    });
  }

  // Validate Dates
  const timeErr = validateEventTimes(event.startDate, event.endDate);
  if (timeErr) {
    errors.push(timeErr);
  }

  // Validate Attendees
  if (event.attendees && Array.isArray(event.attendees)) {
    if (event.attendees.length > 50) {
      errors.push({
        field: "attendees",
        message: "Event cannot have more than 50 attendees in this viewer",
        code: "MAX_ATTENDEES_EXCEEDED",
      });
    }

    for (let i = 0; i < event.attendees.length; i++) {
      const attendee = event.attendees[i];
      if (typeof attendee !== "string") {
        errors.push({
          field: `attendees[${i}]`,
          message: "Attendee must be a string",
          code: "INVALID_TYPE",
        });
      } else if (attendee.includes("@")) {
        const emailErr = validateEmail(attendee);
        if (emailErr) {
          errors.push({
            ...emailErr,
            field: `attendees[${i}]`,
          });
        }
      } else if (attendee.length > 200) {
        errors.push({
          field: `attendees[${i}]`,
          message: "Attendee name exceeds max length of 200 characters",
          code: "MAX_LENGTH_EXCEEDED",
        });
      }
    }
  }

  // Validate Description Length
  if (event.description && event.description.length > 10000) {
    errors.push({
      field: "description",
      message: "Description exceeds maximum allowed size of 10,000 characters",
      code: "MAX_LENGTH_EXCEEDED",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
