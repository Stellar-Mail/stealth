export type CorsPolicy = {
  allowedOrigins: readonly string[];
  allowedMethods: readonly string[];
  allowedHeaders: readonly string[];
  allowCredentials?: boolean;
};

const DEFAULT_ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
const DEFAULT_ALLOWED_HEADERS = [
  "Content-Type",
  "X-Idempotency-Key",
  "X-Request-Id",
  "X-Stealth-Address",
] as const;

function configuredList(value: string | undefined, fallback: readonly string[] = []): string[] {
  if (value === undefined) {
    return [...fallback];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function appendVary(headers: Headers, value: string) {
  const values = new Set(
    (headers.get("Vary") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  values.add(value);
  headers.set("Vary", [...values].join(", "));
}

export function validateCorsPolicy(policy: CorsPolicy) {
  if (policy.allowedOrigins.includes("*")) {
    if (policy.allowCredentials) {
      throw new Error("Invalid CORS policy: wildcard origins cannot be combined with credentials.");
    }
    throw new Error("Invalid CORS policy: allowedOrigins must be an explicit origin allowlist.");
  }
}

export function corsPolicyFromEnv(
  env: Record<string, string | undefined> = process.env,
): CorsPolicy {
  const policy: CorsPolicy = {
    allowedOrigins: configuredList(env.STEALTH_CORS_ALLOWED_ORIGINS),
    allowedMethods: configuredList(env.STEALTH_CORS_ALLOWED_METHODS, DEFAULT_ALLOWED_METHODS),
    allowedHeaders: configuredList(env.STEALTH_CORS_ALLOWED_HEADERS, DEFAULT_ALLOWED_HEADERS),
    allowCredentials: env.STEALTH_CORS_ALLOW_CREDENTIALS?.toLowerCase() === "true",
  };
  validateCorsPolicy(policy);
  return policy;
}

export const apiCorsPolicy = corsPolicyFromEnv();

export function corsEarlyResponse(request: Request, policy: CorsPolicy): Response | undefined {
  const origin = request.headers.get("Origin");
  if (origin !== null && !policy.allowedOrigins.includes(origin)) {
    const headers = new Headers();
    appendVary(headers, "Origin");
    return new Response(null, { status: 403, headers });
  }

  if (request.method.toUpperCase() !== "OPTIONS") {
    return undefined;
  }

  if (origin === null) {
    return new Response(null, { status: 403 });
  }

  const requestedMethod = request.headers.get("Access-Control-Request-Method")?.toUpperCase();
  const allowedMethods = policy.allowedMethods.map((method) => method.toUpperCase());
  const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") ?? "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  const allowedHeaderNames = new Set(policy.allowedHeaders.map((header) => header.toLowerCase()));

  if (
    !requestedMethod ||
    !allowedMethods.includes(requestedMethod) ||
    requestedHeaders.some((header) => !allowedHeaderNames.has(header))
  ) {
    return new Response(null, { status: 403 });
  }

  const headers = new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": allowedMethods.join(", "),
    "Access-Control-Allow-Headers": policy.allowedHeaders.join(", "),
  });
  if (policy.allowCredentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  appendVary(headers, "Origin");
  appendVary(headers, "Access-Control-Request-Method");
  appendVary(headers, "Access-Control-Request-Headers");

  return new Response(null, { status: 204, headers });
}

export function applyCors(request: Request, response: Response, policy: CorsPolicy): Response {
  const origin = request.headers.get("Origin");
  if (origin === null || !policy.allowedOrigins.includes(origin)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  if (policy.allowCredentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  appendVary(headers, "Origin");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
