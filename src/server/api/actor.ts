import { stellarAddressSchema } from "./domain";
import { ApiError } from "./errors";
import type { RequestContext } from "./context";

export const ACTOR_HEADER = "x-stealth-address";

export function requireActor(requestOrContext: Request | RequestContext) {
  const request = "headers" in requestOrContext ? requestOrContext : requestOrContext.request;
  const value = request.headers.get(ACTOR_HEADER);
  if (!value) {
    throw new ApiError(401, "unauthorized", `Missing ${ACTOR_HEADER} header`);
  }

  const result = stellarAddressSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError(401, "unauthorized", `${ACTOR_HEADER} must be a valid Stellar G-address`);
  }

  return result.data;
}

export function requireActorMatches(requestOrContext: Request | RequestContext, expectedAddress: string) {
  const actor = requireActor(requestOrContext);
  if (actor !== expectedAddress) {
    throw new ApiError(403, "forbidden", "The authenticated actor cannot modify this resource");
  }
  return actor;
}
