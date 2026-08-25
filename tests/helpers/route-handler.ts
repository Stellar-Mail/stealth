/**
 * Extract a TanStack Start route server handler without fighting Route generics in tests.
 */
export type RouteHandler = (ctx: {
  request: Request;
  params?: Record<string, string>;
}) => Promise<Response>;

export function getRouteHandler(route: unknown, method: string): RouteHandler {
  const handlers = (
    route as {
      options?: { server?: { handlers?: Record<string, RouteHandler> } };
    }
  ).options?.server?.handlers;
  const handler = handlers?.[method];
  if (!handler) {
    throw new Error(`Missing ${method} handler on route`);
  }
  return handler;
}

export function makeRouteHandlerCtx(
  overrides: { request?: Request; params?: Record<string, string> } = {},
) {
  return {
    request: overrides.request ?? new Request("https://stealth.test/"),
    params: overrides.params ?? {},
  };
}
