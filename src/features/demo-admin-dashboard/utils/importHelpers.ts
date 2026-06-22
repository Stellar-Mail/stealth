import { z } from "zod";
import type { DemoDataset, DemoMessage, DemoSender } from "../types/dataset";
import type { ImportResult, ImportValidationError } from "../types/import";

/**
 * Zod schema for validating DemoDataset JSON.
 * Ensures data is safe, deterministic, and follows required structures.
 */

const SafeEmailSchema = z
  .string()
  .refine(
    (email) =>
      email.endsWith("example.com") ||
      email.endsWith("example.org") ||
      email.endsWith("stealth.demo"),
    {
      message: "Email must use a safe demo domain (example.com, example.org, or stealth.demo)",
    },
  );

const DemoSenderSchema = z.object({
  address: SafeEmailSchema,
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  isTrusted: z.boolean(),
  relayNode: z.string().optional(),
});

const DemoAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().nonnegative(),
  url: z.string().url(),
});

const DemoCalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
  attendees: z.array(SafeEmailSchema),
});

const DemoMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  subject: z.string(),
  snippet: z.string(),
  body: z.string(),
  sender: DemoSenderSchema,
  recipients: z.array(SafeEmailSchema).min(1),
  date: z.string().datetime(),
  isRead: z.boolean(),
  isStarred: z.boolean(),
  snoozeRemindAt: z.string().datetime().optional(),
  labels: z.array(z.string()),
  attachments: z.array(DemoAttachmentSchema),
  calendarEvent: DemoCalendarEventSchema.optional(),
});

const DemoDatasetSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  messages: z.array(DemoMessageSchema),
  senders: z.array(DemoSenderSchema).optional(),
});

/**
 * Parses and validates a JSON string into a DemoDataset.
 */
export function parseDatasetJson(json: string): ImportResult {
  const errors: ImportValidationError[] = [];
  let rawData: any;

  try {
    rawData = JSON.parse(json);
  } catch (e) {
    return {
      success: false,
      errors: [
        {
          path: "json",
          message: "Invalid JSON format: " + (e instanceof Error ? e.message : "unknown error"),
          severity: "error",
        },
      ],
      rawJson: json,
    };
  }

  const result = DemoDatasetSchema.safeParse(rawData);

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      errors.push({
        path: issue.path.join("."),
        message: issue.message,
        severity: "error",
      });
    });

    return {
      success: false,
      errors,
      rawJson: json,
    };
  }

  return {
    success: true,
    dataset: result.data as DemoDataset,
    errors: [],
    rawJson: json,
  };
}
