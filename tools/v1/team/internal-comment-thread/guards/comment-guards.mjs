const TARGET_KINDS = new Set(["message", "thread"]);

const LIMITS = {
  MAX_TARGET_ID_LENGTH: 128,
  MAX_AUTHOR_LENGTH: 254,
  MAX_COMMENT_LENGTH: 4_000,
  MAX_COMMENT_HISTORY: 500,
  MAX_TEAM_MEMBERS: 100,
  MAX_EXPORT_PAYLOAD_BYTES: 50_000,
};

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export class InternalCommentGuardError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "InternalCommentGuardError";
    this.field = field;
  }
}

function stripControlCharacters(value, preserveNewlines = true) {
  const pattern = preserveNewlines
    ? /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g
    : /[\x00-\x1F\x7F-\x9F]/g;
  return value.replace(pattern, "");
}

function cleanText(value, maxLength, preserveNewlines = true) {
  if (typeof value !== "string") {
    return "";
  }
  return stripControlCharacters(value, preserveNewlines).trim().slice(0, maxLength);
}

export function validateTarget(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw new InternalCommentGuardError("target must be a plain object", "target");
  }
  if (!TARGET_KINDS.has(target.kind)) {
    throw new InternalCommentGuardError("target kind must be message or thread", "target.kind");
  }
  if (typeof target.id !== "string" || target.id.length === 0) {
    throw new InternalCommentGuardError("target id is required", "target.id");
  }
  if (target.id.length > LIMITS.MAX_TARGET_ID_LENGTH) {
    throw new InternalCommentGuardError("target id exceeds max length", "target.id");
  }
  if (!SAFE_ID_PATTERN.test(target.id)) {
    throw new InternalCommentGuardError("target id contains unsafe characters", "target.id");
  }
  return { kind: target.kind, id: target.id };
}

export function validateAuthor(author, teamMembers = []) {
  if (typeof author !== "string" || author.length === 0) {
    throw new InternalCommentGuardError("author is required", "author");
  }
  if (author.length > LIMITS.MAX_AUTHOR_LENGTH) {
    throw new InternalCommentGuardError("author exceeds max length", "author");
  }
  if (/[\r\n\0]/.test(author)) {
    throw new InternalCommentGuardError("author contains unsafe control characters", "author");
  }
  const at = author.lastIndexOf("@");
  if (at < 1 || at === author.length - 1) {
    throw new InternalCommentGuardError("author must be an email-like address", "author");
  }
  if (teamMembers.length > 0 && !teamMembers.includes(author)) {
    throw new InternalCommentGuardError("author is not in the team roster", "author");
  }
  return author;
}

export function sanitizeCommentBody(body) {
  return cleanText(body, LIMITS.MAX_COMMENT_LENGTH, true);
}

export function validateCommentBody(body) {
  const sanitized = sanitizeCommentBody(body);
  if (!sanitized) {
    throw new InternalCommentGuardError("comment body is required", "body");
  }
  return sanitized;
}

export function guardCommentHistory(comments) {
  if (!Array.isArray(comments)) {
    throw new InternalCommentGuardError("comments must be an array", "comments");
  }
  if (comments.length > LIMITS.MAX_COMMENT_HISTORY) {
    throw new InternalCommentGuardError("comment history exceeds safe limit", "comments");
  }
  return true;
}

export function guardTeamRoster(teamMembers) {
  if (!Array.isArray(teamMembers)) {
    throw new InternalCommentGuardError("teamMembers must be an array", "teamMembers");
  }
  if (teamMembers.length > LIMITS.MAX_TEAM_MEMBERS) {
    throw new InternalCommentGuardError("team roster exceeds safe limit", "teamMembers");
  }
  for (const member of teamMembers) {
    validateAuthor(member);
  }
  return true;
}

export function validateCommentInput(input, teamMembers = []) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new InternalCommentGuardError("comment input must be a plain object", "comment");
  }
  guardTeamRoster(teamMembers);
  return {
    target: validateTarget(input.target),
    author: validateAuthor(input.author, teamMembers),
    body: validateCommentBody(input.body),
    visibility: "team-only",
  };
}

export function assertExternalPayloadDoesNotLeakComment(payload, comments) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new InternalCommentGuardError("payload must be a plain object", "payload");
  }
  if (!Array.isArray(comments)) {
    throw new InternalCommentGuardError("comments must be an array", "comments");
  }
  const serialized = JSON.stringify(payload);
  if (serialized.length > LIMITS.MAX_EXPORT_PAYLOAD_BYTES) {
    throw new InternalCommentGuardError("payload exceeds safe inspection size", "payload");
  }
  for (const comment of comments) {
    const body = typeof comment?.body === "string" ? comment.body : "";
    if (body && serialized.includes(body)) {
      throw new InternalCommentGuardError(
        "external payload contains internal comment body",
        "payload",
      );
    }
  }
  return true;
}

export function buildExternalReplyPayload(message, replyBody) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new InternalCommentGuardError("message must be a plain object", "message");
  }
  const body = cleanText(replyBody, LIMITS.MAX_COMMENT_LENGTH, true);
  if (!body) {
    throw new InternalCommentGuardError("reply body is required", "replyBody");
  }
  return {
    to: cleanText(message.senderAddress, LIMITS.MAX_AUTHOR_LENGTH, false),
    subject: cleanText(message.subject, 998, false),
    body,
  };
}

export { LIMITS, TARGET_KINDS };
