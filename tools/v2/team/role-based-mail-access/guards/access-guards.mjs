const ALLOWED_ROLES = new Set(["admin", "manager", "agent", "viewer", "guest"]);
const ALLOWED_ACCESS_LEVELS = new Set(["read", "write", "assign", "delete", "manage"]);

const MAX_ROLE_LENGTH = 64;
const MAX_THREAD_ID_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_TEAM_SIZE = 500;
const MAX_ATTACHMENT_COUNT = 100;

const THREAD_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export class AccessValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "AccessValidationError";
    this.field = field;
  }
}

export function sanitizeRole(raw) {
  if (typeof raw !== "string") return null;
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

export function validateRole(role) {
  if (typeof role !== "string" || role.length === 0) {
    throw new AccessValidationError("role must be a non-empty string", "role");
  }
  if (role.length > MAX_ROLE_LENGTH) {
    throw new AccessValidationError(`role exceeds max length of ${MAX_ROLE_LENGTH}`, "role");
  }
  if (!ALLOWED_ROLES.has(role)) {
    throw new AccessValidationError(`"${role}" is not a recognised role`, "role");
  }
  return role;
}

export function validateAccessLevel(level) {
  if (typeof level !== "string" || level.length === 0) {
    throw new AccessValidationError("accessLevel must be a non-empty string", "accessLevel");
  }
  if (!ALLOWED_ACCESS_LEVELS.has(level)) {
    throw new AccessValidationError(`"${level}" is not a recognised access level`, "accessLevel");
  }
  return level;
}

export function validateEmailAddress(email) {
  if (typeof email !== "string" || email.length === 0) {
    throw new AccessValidationError("email must be a non-empty string", "email");
  }
  if (email.length > MAX_EMAIL_LENGTH) {
    throw new AccessValidationError(
      `email exceeds RFC 5321 max length of ${MAX_EMAIL_LENGTH}`,
      "email",
    );
  }
  // Reject header injection characters before any further processing
  if (/[\r\n\0]/.test(email)) {
    throw new AccessValidationError("email contains illegal control characters", "email");
  }
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 1 || atIndex === email.length - 1) {
    throw new AccessValidationError("email is malformed — missing local part or domain", "email");
  }
  return email;
}

export function validateThreadId(threadId) {
  if (typeof threadId !== "string" || threadId.length === 0) {
    throw new AccessValidationError("threadId must be a non-empty string", "threadId");
  }
  if (threadId.length > MAX_THREAD_ID_LENGTH) {
    throw new AccessValidationError(
      `threadId exceeds max length of ${MAX_THREAD_ID_LENGTH}`,
      "threadId",
    );
  }
  // Rejects path traversal (../), spaces, and any non-alphanumeric except _ and -
  if (!THREAD_ID_PATTERN.test(threadId)) {
    throw new AccessValidationError("threadId contains illegal characters", "threadId");
  }
  return threadId;
}

export function validateAccessRequest(req) {
  if (req === null || typeof req !== "object" || Array.isArray(req)) {
    throw new AccessValidationError("access request must be a plain object", "request");
  }
  validateRole(req.role);
  validateAccessLevel(req.accessLevel);
  validateEmailAddress(req.requesterEmail);
  validateThreadId(req.threadId);
  return true;
}

// O(1) access check — builds a Set once per call so callers don't need to pre-compute
export function checkAccess(role, accessLevel, policy) {
  const allowedLevels = policy[role];
  if (!Array.isArray(allowedLevels)) return false;
  return new Set(allowedLevels).has(accessLevel);
}

// Reject oversized team arrays before any per-member role scan
export function guardTeamSize(members) {
  if (!Array.isArray(members)) {
    throw new AccessValidationError("members must be an array", "members");
  }
  if (members.length > MAX_TEAM_SIZE) {
    throw new AccessValidationError(
      `team size ${members.length} exceeds safe limit of ${MAX_TEAM_SIZE} — paginate before scanning`,
      "members",
    );
  }
  return true;
}

// Reject oversized attachment lists before any role-based filter pass
export function guardAttachmentCount(attachments) {
  if (!Array.isArray(attachments)) {
    throw new AccessValidationError("attachments must be an array", "attachments");
  }
  if (attachments.length > MAX_ATTACHMENT_COUNT) {
    throw new AccessValidationError(
      `attachment count ${attachments.length} exceeds safe limit of ${MAX_ATTACHMENT_COUNT} — paginate before filtering`,
      "attachments",
    );
  }
  return true;
}

export const LIMITS = {
  MAX_ROLE_LENGTH,
  MAX_THREAD_ID_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_TEAM_SIZE,
  MAX_ATTACHMENT_COUNT,
  ALLOWED_ROLES: [...ALLOWED_ROLES],
  ALLOWED_ACCESS_LEVELS: [...ALLOWED_ACCESS_LEVELS],
};
