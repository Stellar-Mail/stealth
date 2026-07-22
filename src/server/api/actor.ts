import { Buffer } from "buffer";
import { Keypair } from "@stellar/stellar-sdk";

import { stellarAddressSchema } from "./domain";
import { ApiError } from "./errors";
import { assertActorAuthorized, type DelegatedAuthorization } from "./auth/delegation";
import { extractPrincipal, type ApiContext, type ApiPrincipal } from "./context";

export const ACTOR_HEADER = "x-stealth-address";
export const DELEGATION_HEADER = "x-stealth-delegation";

export function requirePrincipal(requestOrContext: Request | ApiContext): ApiPrincipal {
  if (
    requestOrContext &&
    typeof requestOrContext === "object" &&
    "isAuthenticated" in requestOrContext
  ) {
    if (!requestOrContext.isAuthenticated || !requestOrContext.principal) {
      throw new ApiError(401, "unauthorized", `Missing ${ACTOR_HEADER} header`);
    }
    return requestOrContext.principal;
  }

  const principal = extractPrincipal(requestOrContext as Request);
  if (!principal) {
    throw new ApiError(401, "unauthorized", `Missing ${ACTOR_HEADER} header`);
  }
  return principal;
}

export function requireActor(requestOrContext: Request | ApiContext): string {
  const principal = requirePrincipal(requestOrContext);
  return principal.address;
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
  requestOrContext: Request | ApiContext,
  expectedAddress: string,
  authorization?: DelegatedAuthorization,
) {
  const actor = requireActor(requestOrContext);
  return assertActorAuthorized(actor, expectedAddress, authorization);
}

export function resetActorReplayCache() {
  consumedNonces.clear();
}
