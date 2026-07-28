import { ApiError } from "@/server/api/errors";
import { apiFailure } from "@/server/api/response";

/**
 * Wraps route handlers and enforces allowed HTTP methods.
 * - Supported methods are taken from the keys of `handlers`.
 * - HEAD falls back to GET (headers only).
 * - OPTIONS returns a 200 response with an Allow header.
 * - Unsupported methods throw ApiError(405, 'method_not_allowed', ...)
 */
export function methodGuard<T extends Record<string, any>>(handlers: T) {
  const allowedMethods = Object.keys(handlers).map((m) => m.toUpperCase());

  // Ensure HEAD and OPTIONS appear in the Allow header where appropriate
  if (allowedMethods.includes("GET") && !allowedMethods.includes("HEAD")) {
    allowedMethods.push("HEAD");
  }
  if (!allowedMethods.includes("OPTIONS")) {
    allowedMethods.push("OPTIONS");
  }

  return async (request: Request) => {
    const method = request.method.toUpperCase();

    // HEAD – reuse GET handler then strip body
    if (method === "HEAD" && handlers["GET"]) {
      const resp = await handlers["GET"]({ request });
      return new Response(null, {
        status: resp.status,
        headers: resp.headers,
      });
    }

    // OPTIONS – send Allow header (add any CORS headers if needed here)
    if (method === "OPTIONS") {
      const headers = new Headers({ Allow: allowedMethods.join(", ") });
      return new Response(null, { status: 200, headers });
    }

    // Supported method – forward to handler
    const handler = (handlers as any)[method];
    if (handler) {
      return await handler({ request });
    }

    // Unsupported – trigger shared error envelope via ApiError
    throw new ApiError(405, "method_not_allowed", `Method ${method} not allowed for this endpoint`);
  };
}

export type MethodHandlers = Record<
  string,
  (args: { request: Request }) => Promise<Response> | Response
>;
