import { z, type ZodType } from "zod";

import { ApiError } from "./errors";

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

function assertJsonContentType(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
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

  if (!body.trim()) {
    throw new ApiError(400, "bad_request", "Request body must not be empty");
  }

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

const MULTI_VALUED_SCALARS = new Set<string>();

export function parseSearchParams<T>(request: Request, schema: ZodType<T>): T {
  const url = new URL(request.url);
  const seen = new Map<string, string[]>();
  for (const [key, value] of url.searchParams.entries()) {
    if (MULTI_VALUED_SCALARS.has(key)) {
      continue;
    }
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

  const params = Object.fromEntries(url.searchParams.entries());
  return schema.parse(params);
}

export const paginationSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export { DEFAULT_MAX_BODY_BYTES };
