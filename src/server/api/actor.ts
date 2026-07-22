import { stellarAddressSchema } from "./domain";
import { ApiError } from "./errors";
import { assertActorAuthorized, type DelegatedAuthorization } from "./auth/delegation";

export const ACTOR_HEADER = "x-stealth-address";
export const DELEGATION_HEADER = "x-stealth-delegation";

export function requireActor(request: Request) {
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

export function parseDelegationHeader(
  request: Request,
  action: string,
  resource: string,
): DelegatedAuthorization | undefined {
  const value = request.headers.get(DELEGATION_HEADER);
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value);
    const delegations = Array.isArray(parsed) ? parsed : [parsed];
    return { action, resource, delegations };
  } catch {
    return undefined;
  }
}

export function requireActorMatches(
  request: Request,
  expectedAddress: string,
  authorization?: DelegatedAuthorization,
) {
  const actor = requireActor(request);
  return assertActorAuthorized(actor, expectedAddress, authorization);
}
