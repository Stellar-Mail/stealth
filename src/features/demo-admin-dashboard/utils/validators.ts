import { DemoDataValidationError } from './validation-errors';

// Define the expected shape of the demo dataset
export interface DemoEmail {
  id: string;
  subject: string;
  sender: string;
  body: string;
}

export interface DemoDataset {
  version: string;
  emails: DemoEmail[];
}

// Helper for type-checking plain objects
const isPlainObject = (val: unknown): val is Record<string, unknown> => {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
};

// Runtime Validator
export function validateDemoDataset(data: unknown): DemoDataset {
  const issues: string[] = [];

  if (!isPlainObject(data)) {
    throw new DemoDataValidationError(['Dataset must be a valid JSON object.']);
  }

  // Validate version
  if (typeof data.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(data.version)) {
    issues.push("Missing or invalid 'version' (expected semantic version string like '1.0.0').");
  }

  // Validate emails array
  if (!Array.isArray(data.emails)) {
    issues.push("Missing or invalid 'emails' property (expected an array).");
  } else {
    data.emails.forEach((email: unknown, index: number) => {
      if (!isPlainObject(email)) {
        issues.push(`Email at index ${index} must be an object.`);
        return;
      }
      
      if (typeof email.id !== 'string' || email.id.trim() === '') {
        issues.push(`Email at index ${index} has missing or invalid 'id'.`);
      }
      if (typeof email.subject !== 'string') {
        issues.push(`Email at index ${index} has missing or invalid 'subject'.`);
      }
      if (typeof email.sender !== 'string' || !email.sender.includes('@')) {
        issues.push(`Email at index ${index} has missing or invalid 'sender' email address.`);
      }
      if (typeof email.body !== 'string') {
        issues.push(`Email at index ${index} has missing or invalid 'body'.`);
      }
    });
  }

  if (issues.length > 0) {
    throw new DemoDataValidationError(issues);
  }

  // If we pass, cast safely
  return data as DemoDataset;
}
