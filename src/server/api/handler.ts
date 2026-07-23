import { z } from "zod";
import { requireActor } from "./actor";
import { getApiContext, type ApiContext, type ApiPrincipal } from "./context";
import { ApiError } from "./errors";
import { apiFailure, apiSuccess } from "./response";
import * as metrics from "./metrics";
import { parseJsonBody } from "./request";
import { consumeRouteQuota, type RateLimitConfig } from "./rate-limit";

export type { RateLimitConfig } from "./rate-limit";

// Define authentication mode options
export type AuthMode = "public" | "optional" | "required";

export type RouteConfig<
  BodySchema extends z.ZodTypeAny,
  QuerySchema extends z.ZodTypeAny,
  ParamsSchema extends z.ZodTypeAny,
> = {
  /**
   * Backwards-compat: legacy boolean flag. If set, it overrides `authMode`.
   * Deprecated: prefer using `authMode` ("public" | "optional" | "required").
   */
  requireAuth?: boolean;

  /**
   * Authentication mode for the route.
   * - "public": No authentication performed. (default)
   * - "optional": Authentication attempted if credentials are present.
   * - "required": Authentication is mandatory.
   */
  authMode?: AuthMode; // defaults to "public"
  /** Optional authorization policy function. Return true to allow, false to reject. */
  authPolicy?: (actorId: string, request: Request) => boolean | Promise<boolean>;
  rateLimit?: RateLimitConfig;
  bodySchema?: BodySchema;
  querySchema?: QuerySchema;
  paramsSchema?: ParamsSchema;
  cacheSeconds?: number;
  handler: (context: {
    request: Request;
    apiContext: ApiContext;
    principal?: ApiPrincipal;
    actorId?: string;
    body: z.infer<BodySchema>;
    query: z.infer<QuerySchema>;
    params: z.infer<ParamsSchema>;
  }) => Promise<Response> | Response;
};

export function createRouteHandler<
  BodySchema extends z.ZodTypeAny = z.ZodAny,
  QuerySchema extends z.ZodTypeAny = z.ZodAny,
  ParamsSchema extends z.ZodTypeAny = z.ZodAny,
>(config: RouteConfig<BodySchema, QuerySchema, ParamsSchema>) {
  return async (request: Request, params?: Record<string, string>): Promise<Response> => {
    const startTime = performance.now();
    const method = request.method;
    const url = new URL(request.url);
    const path = url.pathname;

    let actorId: string | undefined;

    try {
      // 0. Resolve request-scoped ApiContext
      const apiContext = await getApiContext(request);

      // 1. Authentication based on authMode (new) and legacy requireAuth (old)
      let mode: AuthMode = "public";
      if (typeof config.requireAuth === "boolean") {
        mode = config.requireAuth ? "required" : "public";
      } else if (config.authMode) {
        mode = config.authMode;
      }
      if (mode === "required") {
        actorId = requireActor(apiContext);
      } else if (mode === "optional") {
        try {
          actorId = requireActor(apiContext);
        } catch (_) {
          actorId = undefined;
        }
      } // "public" leaves actorId undefined

      // 2. Authorization policy if provided
      if (config.authPolicy) {
        // If policy requires an authenticated actor but none is present, fail closed
        if (!actorId) {
          throw new ApiError(401, "unauthorized", "Authentication required for policy evaluation");
        }
        const authorized = await Promise.resolve(config.authPolicy(actorId, request));
        if (!authorized) {
          throw new ApiError(403, "forbidden", "Authorization policy rejected the request");
        }
      }

      // 3. Rate Limiting
      if (config.rateLimit) {
        const repo = apiContext.repository;
        let subject: string;
        if (config.rateLimit.type === "account") {
          if (!actorId) {
            throw new ApiError(401, "unauthorized", "Account rate limit requires authentication");
          }
          subject = actorId;
        } else {
          subject =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";
        }

        const limit = await consumeRouteQuota(
          repo,
          config.rateLimit.type,
          subject,
          config.rateLimit.operation,
        );
        if (!limit.allowed) {
          throw new ApiError(
            429,
            "too_many_requests",
            `${config.rateLimit.type === "account" ? "Account" : "IP"} limit exceeded`,
            {
              retryAfterSeconds: limit.retryAfterSeconds,
            },
          );
        }
      }

      // 4. Validation
      let parsedBody: any = undefined;
      let parsedQuery: any = undefined;
      let parsedParams: any = undefined;

      if (config.bodySchema) {
        parsedBody = await parseJsonBody(request, config.bodySchema);
      }

      if (config.querySchema) {
        const queryObj = Object.fromEntries(url.searchParams.entries());
        const result = config.querySchema.safeParse(queryObj);
        if (!result.success) {
          throw new ApiError(400, "bad_request", "Invalid query parameters");
        }
        parsedQuery = result.data;
      }

      if (config.paramsSchema) {
        const result = config.paramsSchema.safeParse(params || {});
        if (!result.success) {
          throw new ApiError(400, "bad_request", "Invalid route parameters");
        }
        parsedParams = result.data;
      }

      // 5. Execute Route
      let response = await config.handler({
        request,
        apiContext,
        principal: apiContext.isAuthenticated ? apiContext.principal : undefined,
        actorId,
        body: parsedBody,
        query: parsedQuery,
        params: parsedParams,
      });

      // 6. Caching
      if (config.cacheSeconds && response.status === 200) {
        // Need to create a new response to mutate headers if it's from a factory
        response = new Response(response.body, response);
        response.headers.set("Cache-Control", `public, max-age=${config.cacheSeconds}`);
      }

      // 7. Success Metrics & Logs
      const latency = performance.now() - startTime;
      metrics.recordHistogram("api_latency", latency, {
        method,
        path,
        status: String(response.status),
      });
      metrics.incrementCounter("api_requests_total", {
        method,
        path,
        status: String(response.status),
      });

      console.log(`[API SUCCESS] ${method} ${path} - ${response.status} (${latency.toFixed(2)}ms)`);

      return response;
    } catch (error: any) {
      // 8. Error Metrics & Logs
      const latency = performance.now() - startTime;
      const status = error instanceof ApiError ? error.status : 500;

      metrics.recordHistogram("api_latency", latency, { method, path, status: String(status) });
      metrics.incrementCounter("api_requests_total", { method, path, status: String(status) });
      metrics.incrementCounter("api_errors_total", { method, path, status: String(status) });

      console.error(`[API ERROR] ${method} ${path} - ${status} (${latency.toFixed(2)}ms)`, error);

      return apiFailure(request, error);
    }
  };
}
