import { normalizeApiError } from "./errors";
import { apiCorsPolicy, applyCors, corsEarlyResponse } from "./cors";

interface ApiMeta {
  requestId: string;
  timestamp: string;
}

interface SuccessEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

interface ErrorEnvelope {
  error: {
    code: string;
    details?: unknown;
    message: string;
  };
  meta: ApiMeta;
}

interface ResponseOptions {
  headers?: HeadersInit;
  status?: number;
}

function getRequestId(request: Request) {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

function responseHeaders(requestId: string, headers?: HeadersInit) {
  const result = new Headers(headers);
  result.set("cache-control", "no-store");
  result.set("content-type", "application/json; charset=utf-8");
  result.set("x-request-id", requestId);
  return result;
}

function meta(requestId: string): ApiMeta {
  return {
    requestId,
    timestamp: new Date().toISOString(),
  };
}

export function apiSuccess<T>(request: Request, data: T, options: ResponseOptions = {}) {
  const requestId = getRequestId(request);
  const body: SuccessEnvelope<T> = { data, meta: meta(requestId) };

  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: responseHeaders(requestId, options.headers),
  });
}

export function apiFailure(request: Request, caught: unknown) {
  const requestId = getRequestId(request);
  const error = normalizeApiError(caught);
  const body: ErrorEnvelope = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
    meta: meta(requestId),
  };

  return new Response(JSON.stringify(body), {
    status: error.status,
    headers: responseHeaders(requestId),
  });
}

export async function handleApiRequest(
  request: Request,
  handler: () => Response | Promise<Response>,
) {
  const earlyResponse = corsEarlyResponse(request, apiCorsPolicy);
  if (earlyResponse) {
    return earlyResponse;
  }

  try {
    return applyCors(request, await handler(), apiCorsPolicy);
  } catch (error) {
    return applyCors(request, apiFailure(request, error), apiCorsPolicy);
  }
}

export type { ApiMeta, ErrorEnvelope, ResponseOptions, SuccessEnvelope };
