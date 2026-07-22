import { normalizeApiError } from "./errors";
import { getRequestContext } from "./context";

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
    retryable: boolean;
    retryClassification: RetryClassification;
    retryAfter?: number;
  };
  meta: ApiMeta;
}
 
interface ResponseOptions {
  cachePolicy?: CachePolicy;
  headers?: HeadersInit;
  status?: number;
}
 
function getRequestId(request: Request) {
  const context = getRequestContext();
  if (context?.requestId) {
    return context.requestId;
  }
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

function responseHeaders(
  requestId: string,
  headers?: HeadersInit,
  cachePolicy: CachePolicy = "NO_STORE",
) {
  const result = new Headers(headers);
  const cacheControl = CACHE_POLICIES[cachePolicy];
  const suppliedCacheControl = result.get("cache-control");

  if (suppliedCacheControl !== null && suppliedCacheControl !== cacheControl) {
    throw new TypeError(
      "Cache-Control must be configured with a named cache policy; conflicting directives are not allowed",
    );
  }

  result.set("cache-control", cacheControl);
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
    headers: responseHeaders(requestId, options.headers, options.cachePolicy),
  });
}

export function apiFailure(request: Request, caught: unknown) {
  const requestId = getRequestId(request);
  const routeId = new URL(request.url).pathname;
  const error = normalizeApiError(caught, { requestId, routeId });
  const body: ErrorEnvelope = {
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      retryClassification: error.retryClassification,
      ...(error.retryAfterSeconds === undefined ? {} : { retryAfter: error.retryAfterSeconds }),
      ...(error.details === undefined ? {} : { details: error.details }),
    },
    meta: meta(requestId),
  };

  const headers = responseHeaders(requestId);
  if (error.retryAfterSeconds !== undefined) {
    headers.set("retry-after", String(error.retryAfterSeconds));
  }

  return new Response(JSON.stringify(body), {
    status: error.status,
    headers,
  });
}

export async function handleApiRequest(
  request: Request,
  handler: () => Response | Promise<Response>,
) {
  try {
    return await handler();
  } catch (error) {
    return apiFailure(request, error);
  }
}

export type { ApiMeta, CachePolicy, ErrorEnvelope, ResponseOptions, SuccessEnvelope };
