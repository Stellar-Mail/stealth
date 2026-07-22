import { z, type ZodType } from "zod";

import { ApiError } from "./errors";

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

function assertJsonContentType(request: Request) {
  const raw = request.headers.get("content-type");
  if (!raw) {
    throw new ApiError(415, "bad_request", "Content-Type header is missing");
  }
  // Trim whitespace and ignore case
  const contentType = raw.trim().toLowerCase();
  // Regex matches "application/json" or "application/*+json" with optional parameters
  const jsonTypeRegex = /^application\/(?:[\w!#$&^_.-]+\+)?json(?:\s*;.*)?$/i;
  if (!jsonTypeRegex.test(contentType)) {
    throw new ApiError(415, "bad_request", "Content-Type must be application/json");
  }
}

function validateContentLength(request: Request, maxBytes: number): void {
  const raw = request.headers.get("content-length");
  if (raw === null) return;
  const declaredLength = Number(raw);
  if (!Number.isInteger(declaredLength) || declaredLength < 0) {
    throw new ApiError(400, "bad_request", "Content-Length must be a non-negative integer");
  }
  if (declaredLength > maxBytes) {
    throw new ApiError(413, "bad_request", `Request body exceeds ${maxBytes} bytes`);
  }
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes = DEFAULT_MAX_BODY_BYTES,
): Promise<T> {
  assertJsonContentType(request);

  validateContentLength(request, maxBytes);

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new ApiError(413, "bad_request", `Request body exceeds ${maxBytes} bytes`);
  }

  try {
    return schema.parse(JSON.parse(body));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError(400, "bad_request", "Request body contains invalid JSON");
    }
    throw error;
  }
}

/** Maximum length (characters) of the raw query string, keys, values, and separators included. */
const DEFAULT_MAX_QUERY_LENGTH = 2048;
/** Maximum length (characters) of a single decoded, normalized parameter value. */
const DEFAULT_MAX_QUERY_VALUE_LENGTH = 1024;

/**
 * Control characters rejected in parameter names and values: C0 controls
 * (U+0000–U+001F), DEL (U+007F), and C1 controls (U+0080–U+009F). These never
 * appear legitimately in a decoded query parameter and are common vectors for
 * log injection, header smuggling, and parser confusion.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

export interface SearchParamsOptions {
  /** Cap on the raw query string length. Default {@link DEFAULT_MAX_QUERY_LENGTH}. */
  maxQueryLength?: number;
  /** Cap on each decoded, normalized parameter value length. Default {@link DEFAULT_MAX_QUERY_VALUE_LENGTH}. */
  maxValueLength?: number;
  /**
   * Parameter names that may appear more than once.
   * Their values are collected into an array instead of triggering a
   * duplicate-parameter error. All other (scalar) parameters must appear
   * at most once.
   */
  multiValuedFields?: ReadonlySet<string>;
}

/**
 * Normalize and validate a request's query string before schema parsing.
 *
 * Rules, applied before any domain schema sees the data:
 * - The raw query string may not exceed `maxQueryLength` characters (HTTP 414).
 * - Each decoded value may not exceed `maxValueLength` characters (HTTP 414).
 * - Empty parameter names (e.g. `?=value`) are rejected (HTTP 400).
 * - Control characters in any name or value are rejected (HTTP 400).
 * - Names and values are Unicode NFC-normalized so canonically equivalent
 *   sequences validate identically. ASCII values (cursors, numbers, hex ids,
 *   Stellar addresses) are unaffected, so valid encoded values are never
 *   changed unexpectedly.
 *
 * Duplicate names keep last-value-wins semantics, matching the previous
 * `Object.fromEntries` behavior. Use {@link parseSearchParams} to reject
 * duplicate scalar parameters before the schema sees the data.
 */
export function normalizeSearchParams(
  request: Request,
  options: SearchParamsOptions = {},
): Record<string, string> {
  const maxQueryLength = options.maxQueryLength ?? DEFAULT_MAX_QUERY_LENGTH;
  const maxValueLength = options.maxValueLength ?? DEFAULT_MAX_QUERY_VALUE_LENGTH;

  const url = new URL(request.url);
  const rawQuery = url.search.startsWith("?") ? url.search.slice(1) : url.search;
  if (rawQuery.length > maxQueryLength) {
    throw new ApiError(414, "bad_request", `Query string exceeds ${maxQueryLength} characters`);
  }

  const params: Record<string, string> = {};
  for (const [rawName, rawValue] of url.searchParams.entries()) {
    if (rawName.length === 0) {
      throw new ApiError(400, "bad_request", "Query parameter names must not be empty");
    }
    if (CONTROL_CHARACTERS.test(rawName) || CONTROL_CHARACTERS.test(rawValue)) {
      throw new ApiError(
        400,
        "bad_request",
        "Query parameters must not contain control characters",
      );
    }

    const name = rawName.normalize("NFC");
    const value = rawValue.normalize("NFC");
    if (value.length > maxValueLength) {
      throw new ApiError(
        414,
        "bad_request",
        `Query parameter "${name}" exceeds ${maxValueLength} characters`,
      );
    }

    params[name] = value;
  }

  return params;
}

export function parseSearchParams<T>(
  request: Request,
  schema: ZodType<T>,
  options?: SearchParamsOptions,
): T {
  const multiValued = options?.multiValuedFields ?? new Set<string>();
  const url = new URL(request.url);

  // Detect duplicate scalar parameters before normalization.
  const seen = new Map<string, string[]>();
  for (const [key, value] of url.searchParams.entries()) {
    if (multiValued.has(key)) continue;
    const prev = seen.get(key) ?? [];
    prev.push(value);
    seen.set(key, prev);
  }
  for (const [key, values] of seen) {
    if (values.length > 1) {
      throw new ApiError(
        400,
        "bad_request",
        `Duplicate query parameter: ${key}. Expected a single value for '${key}'.`,
      );
    }
  }

  const normalized = normalizeSearchParams(request, options);

  // Multi-valued fields: collect every occurrence into an array.
  for (const key of multiValued) {
    const allValues = url.searchParams.getAll(key);
    if (allValues.length > 0) {
      (normalized as Record<string, unknown>)[key] = allValues.map((v) => v.normalize("NFC"));
    }
  }

  return schema.parse(normalized);
}

export const paginationSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export { DEFAULT_MAX_BODY_BYTES };
