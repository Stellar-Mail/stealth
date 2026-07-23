import { stellarAddressSchema } from "./domain";
import { ApiError } from "./errors";
import { assertActorAuthorized, type DelegatedAuthorization } from "./auth/delegation";
import { extractPrincipal, type ApiContext, type ApiPrincipal } from "./context";
import { recordAuditEvent } from "./audit";

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
  const isDelegated = actor !== expectedAddress;
  const requestId =
    requestOrContext && typeof requestOrContext === "object" && "headers" in requestOrContext
      ? (requestOrContext as Request).headers.get("x-request-id")?.trim() || ""
      : (requestOrContext as ApiContext).requestId || "";

  if (isDelegated) {
    try {
      const res = assertActorAuthorized(actor, expectedAddress, authorization);
      recordAuditEvent({
        actor,
        action: "delegation.authorize",
        targetType: "mailbox",
        safeTargetReference: `mailbox:${expectedAddress}`,
        result: "success",
        requestId,
      });
      return res;
    } catch (error) {
      recordAuditEvent({
        actor,
        action: "delegation.authorize",
        targetType: "mailbox",
        safeTargetReference: `mailbox:${expectedAddress}`,
        result: "denied",
        requestId,
      });
      throw error;
    }
  }

  return assertActorAuthorized(actor, expectedAddress, authorization);
}

/**
 * Issue #1467: reusable authorization for actor-owned resources.
 *
 * These helpers operate on a *verified* {@link ApiPrincipal} rather than a
 * header-derived string, return a stable `forbidden` error code on mismatch,
 * and produce structured, non-sensitive audit metadata describing every
 * authorization decision.
 */

/** A single, safe piece of resource metadata for audit records. */
export type AuthzResourceMetadata = Record<string, string | number | boolean>;

export interface AuthorizationRequest {
  /** The verified principal requesting the action. */
  principal: ApiPrincipal;
  /** The address that owns the resource. */
  resourceOwner: string;
  /** The action being attempted (e.g. "policy:update"). */
  action: string;
  /** Safe, non-sensitive metadata identifying the resource (e.g. resource id/type). */
  resource?: AuthzResourceMetadata;
  /** Optional delegated authorization to consider when the actor is not the owner. */
  delegation?: DelegatedAuthorization;
}

export type AuthorizationDecision = "allow" | "deny";
export type AuthorizationReason = "owner" | "delegated" | "not_owner" | "anonymous";

/** Structured, non-sensitive audit record for an authorization decision. */
export interface AuthorizationAudit {
  decision: AuthorizationDecision;
  reason: AuthorizationReason;
  action: string;
  /** The verified actor address, or null when unauthenticated. */
  actor: string | null;
  resourceOwner: string;
  authMethod: string | null;
  resource?: AuthzResourceMetadata;
}

export interface AuthorizationResult {
  authorized: boolean;
  actor: string;
  audit: AuthorizationAudit;
}

/** Stable forbidden code emitted for every ownership/authorization mismatch. */
export const AUTHORIZATION_FORBIDDEN_CODE = "forbidden" as const;

function buildAudit(
  decision: AuthorizationDecision,
  reason: AuthorizationReason,
  request: AuthorizationRequest,
  actor: string | null,
): AuthorizationAudit {
  return {
    decision,
    reason,
    action: request.action,
    actor,
    resourceOwner: request.resourceOwner,
    authMethod: request.principal?.authMethod ?? null,
    ...(request.resource === undefined ? {} : { resource: request.resource }),
  };
}

/**
 * Evaluate whether a verified principal may act on an actor-owned resource,
 * without throwing. Returns the decision plus a structured audit record.
 *
 * A principal is authorized when it is the resource owner, or when a valid
 * delegation grants the requested action on the resource.
 */
export function evaluateResourceAuthorization(request: AuthorizationRequest): AuthorizationResult {
  const actor = request.principal.address;

  if (actor === request.resourceOwner) {
    return {
      authorized: true,
      actor,
      audit: buildAudit("allow", "owner", request, actor),
    };
  }

  if (request.delegation) {
    try {
      assertActorAuthorized(actor, request.resourceOwner, request.delegation);
      return {
        authorized: true,
        actor,
        audit: buildAudit("allow", "delegated", request, actor),
      };
    } catch {
      // Fall through to a denied decision with a consistent reason.
    }
  }

  return {
    authorized: false,
    actor,
    audit: buildAudit("deny", "not_owner", request, actor),
  };
}

/**
 * Authorize a verified principal against an actor-owned resource, throwing a
 * stable {@link ApiError} with the `forbidden` code when the principal is not
 * permitted. The returned audit record should be emitted by callers regardless
 * of outcome.
 */
export function authorizeResourceOwner(request: AuthorizationRequest): AuthorizationResult {
  const result = evaluateResourceAuthorization(request);
  if (!result.authorized) {
    throw new ApiError(
      403,
      AUTHORIZATION_FORBIDDEN_CODE,
      "The authenticated actor is not permitted to perform this action",
      {
        audit: result.audit,
      },
    );
  }
  return result;
}
