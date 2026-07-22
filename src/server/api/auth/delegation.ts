import { ApiError } from "../errors";

export interface MailboxDelegation {
  grantor: string;
  delegate: string;
  allowedActions: readonly string[];
  resourceScope: readonly string[];
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
}

export interface DelegatedAuthorization {
  action: string;
  resource: string;
  delegations: readonly MailboxDelegation[];
  now?: Date;
}

function forbidden(message: string): never {
  throw new ApiError(403, "forbidden", message);
}

export function assertDelegationCanBeIssued(actor: string, delegation: MailboxDelegation) {
  if (actor !== delegation.grantor) {
    forbidden("Only the mailbox owner can issue or expand a delegation");
  }

  const issuedAt = Date.parse(delegation.issuedAt);
  const expiresAt = Date.parse(delegation.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) {
    forbidden("Delegation expiry must be later than its issue time");
  }

  if (delegation.allowedActions.length === 0 || delegation.resourceScope.length === 0) {
    forbidden("Delegations must include at least one action and resource");
  }

  return delegation;
}

export function assertActorAuthorized(
  actor: string,
  owner: string,
  authorization?: DelegatedAuthorization,
) {
  if (actor === owner) return actor;
  if (!authorization) forbidden("The authenticated actor cannot modify this resource");

  const now = (authorization.now ?? new Date()).getTime();
  const candidates = authorization.delegations.filter(
    (delegation) => delegation.grantor === owner && delegation.delegate === actor,
  );

  for (const delegation of candidates) {
    if (delegation.revoked) forbidden("The delegation has been revoked");

    const issuedAt = Date.parse(delegation.issuedAt);
    const expiresAt = Date.parse(delegation.expiresAt);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || now < issuedAt) {
      forbidden("The delegation is not yet valid");
    }
    if (now >= expiresAt) forbidden("The delegation has expired");

    if (
      delegation.allowedActions.includes(authorization.action) &&
      delegation.resourceScope.includes(authorization.resource)
    ) {
      return actor;
    }
  }

  forbidden("The authenticated actor is outside the delegated action or resource scope");
}
