import type { Draft } from "../types/draft";
import { DATASET_EXPORT_SCHEMA_VERSION } from "../types/datasetExport";
import { isSafeDemoRecipient } from "../seed-helpers/campaignSeed";
import type { DatasetImportIssue, DatasetImportResult } from "../types/datasetImport";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate and normalize a single draft entry, pushing any problems onto
 * `issues`. Returns a clean Draft when valid, otherwise null.
 */
function mapDraft(entry: unknown, index: number, issues: DatasetImportIssue[]): Draft | null {
  const base = `drafts[${index}]`;

  if (!isPlainObject(entry)) {
    issues.push({ path: base, message: "Draft must be an object." });
    return null;
  }

  let valid = true;

  if (!isNonEmptyString(entry.id)) {
    issues.push({ path: `${base}.id`, message: "Draft id is required." });
    valid = false;
  }

  if (typeof entry.subject !== "string") {
    issues.push({ path: `${base}.subject`, message: "Draft subject must be a string." });
    valid = false;
  }

  if (typeof entry.body !== "string") {
    issues.push({ path: `${base}.body`, message: "Draft body must be a string." });
    valid = false;
  }

  const cleanRecipients: string[] = [];
  if (!Array.isArray(entry.recipients)) {
    issues.push({ path: `${base}.recipients`, message: "Draft recipients must be an array." });
    valid = false;
  } else {
    const recipients: unknown[] = entry.recipients;
    recipients.forEach((recipient, rIndex) => {
      if (typeof recipient !== "string") {
        issues.push({
          path: `${base}.recipients[${rIndex}]`,
          message: "Recipient must be a string.",
        });
        valid = false;
      } else if (!isSafeDemoRecipient(recipient)) {
        issues.push({
          path: `${base}.recipients[${rIndex}]`,
          message: `Recipient '${recipient}' is not a safe demo address.`,
        });
        valid = false;
      } else {
        cleanRecipients.push(recipient);
      }
    });
  }

  if (!valid) {
    return null;
  }

  return {
    id: (entry.id as string).trim(),
    subject: entry.subject as string,
    body: entry.body as string,
    recipients: cleanRecipients,
  };
}

/**
 * Map an already-parsed import payload into review-safe drafts. The import is
 * atomic: if any problem is found, no drafts are returned.
 */
export function mapImportedDataset(payload: unknown): DatasetImportResult {
  const issues: DatasetImportIssue[] = [];

  if (!isPlainObject(payload)) {
    return { ok: false, issues: [{ path: "$", message: "Import payload must be a JSON object." }] };
  }

  if (payload.version !== DATASET_EXPORT_SCHEMA_VERSION) {
    issues.push({
      path: "version",
      message: `Unsupported schema version. Expected ${DATASET_EXPORT_SCHEMA_VERSION}.`,
    });
  }

  if (!Array.isArray(payload.drafts)) {
    issues.push({ path: "drafts", message: "drafts must be an array." });
    return { ok: false, issues };
  }

  const draftEntries: unknown[] = payload.drafts;

  if (typeof payload.count === "number" && payload.count !== draftEntries.length) {
    issues.push({
      path: "count",
      message: `count (${payload.count}) does not match drafts length (${draftEntries.length}).`,
    });
  }

  const drafts: Draft[] = [];
  const seenIds = new Set<string>();

  draftEntries.forEach((entry, index) => {
    const draft = mapDraft(entry, index, issues);
    if (!draft) {
      return;
    }
    if (seenIds.has(draft.id)) {
      issues.push({ path: `drafts[${index}].id`, message: `Duplicate draft id '${draft.id}'.` });
      return;
    }
    seenIds.add(draft.id);
    drafts.push(draft);
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, drafts };
}

/**
 * Parse a raw JSON string and map it into review-safe drafts. Invalid JSON is
 * reported as a normal import issue rather than throwing.
 */
export function parseDatasetImport(raw: string): DatasetImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, issues: [{ path: "$", message: "Import payload is not valid JSON." }] };
  }
  return mapImportedDataset(parsed);
}
