export const COMMENT_LIMITS = Object.freeze({
  maxBodyLength: 4_000,
  maxCommentsPerTarget: 500,
  maxTargetIdLength: 160,
});

const TARGET_KINDS = new Set(["message", "thread"]);

export class InternalCommentError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "InternalCommentError";
    this.details = details;
  }
}

export function sanitizeCommentText(value, fieldName, options = {}) {
  const { maxLength = 1_000, required = true } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw new InternalCommentError(`${fieldName} is required`, { fieldName });
    }

    return "";
  }

  if (typeof value !== "string") {
    throw new InternalCommentError(`${fieldName} must be a string`, { fieldName });
  }

  const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

  if (required && normalized === "") {
    throw new InternalCommentError(`${fieldName} cannot be empty`, { fieldName });
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function normalizeTeamAddress(value, fieldName) {
  const address = sanitizeCommentText(value, fieldName, { maxLength: 320 }).toLowerCase();

  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new InternalCommentError(`${fieldName} must be a valid team address`, { fieldName });
  }

  return address;
}

export function normalizeCommentTarget(target) {
  if (!target || typeof target !== "object") {
    throw new InternalCommentError("comment target is required");
  }

  const kind = sanitizeCommentText(target.kind, "target.kind", { maxLength: 32 });

  if (!TARGET_KINDS.has(kind)) {
    throw new InternalCommentError("target kind is not supported", { kind });
  }

  return {
    kind,
    id: sanitizeCommentText(target.id, "target.id", {
      maxLength: COMMENT_LIMITS.maxTargetIdLength,
    }),
  };
}

function targetKey(target) {
  return `${target.kind}:${target.id}`;
}

function normalizeRoster(roster) {
  if (!Array.isArray(roster)) {
    throw new InternalCommentError("team roster must be an array");
  }

  return new Set(roster.map((member) => normalizeTeamAddress(member, "teamRoster[]")));
}

function assertAuthorized(author, teamRoster) {
  const normalizedAuthor = normalizeTeamAddress(author, "author");

  if (!teamRoster.has(normalizedAuthor)) {
    throw new InternalCommentError("author is not authorized for this internal thread", {
      author: normalizedAuthor,
    });
  }

  return normalizedAuthor;
}

export function createInternalCommentService(options = {}) {
  const teamRoster = normalizeRoster(options.teamRoster ?? []);
  const now = options.now ?? (() => new Date().toISOString());
  const commentsById = new Map();
  let sequence = 0;

  function nextId() {
    sequence += 1;
    return `internal-comment-${String(sequence).padStart(4, "0")}`;
  }

  function addComment(input) {
    if (!input || typeof input !== "object") {
      throw new InternalCommentError("comment input is required");
    }

    const target = normalizeCommentTarget(input.target);
    const author = assertAuthorized(input.author, teamRoster);
    const activeForTarget = listComments(target);

    if (activeForTarget.length >= COMMENT_LIMITS.maxCommentsPerTarget) {
      throw new InternalCommentError("comment target has reached the local comment limit", {
        maxCommentsPerTarget: COMMENT_LIMITS.maxCommentsPerTarget,
      });
    }

    const createdAt = input.createdAt
      ? new Date(sanitizeCommentText(input.createdAt, "createdAt", { maxLength: 64 })).toISOString()
      : now();

    if (Number.isNaN(new Date(createdAt).getTime())) {
      throw new InternalCommentError("createdAt must be a valid ISO timestamp");
    }

    const comment = {
      id: input.id ? sanitizeCommentText(input.id, "id", { maxLength: 160 }) : nextId(),
      target,
      author,
      body: sanitizeCommentText(input.body, "body", {
        maxLength: COMMENT_LIMITS.maxBodyLength,
      }),
      createdAt,
      updatedAt: null,
      deletedAt: null,
      visibility: "team-only",
    };

    commentsById.set(comment.id, comment);
    return { ...comment, target: { ...comment.target } };
  }

  function listComments(target) {
    const normalizedTarget = normalizeCommentTarget(target);
    const key = targetKey(normalizedTarget);

    return [...commentsById.values()]
      .filter((comment) => targetKey(comment.target) === key && !comment.deletedAt)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((comment) => ({ ...comment, target: { ...comment.target } }));
  }

  function updateComment(id, body, author) {
    const commentId = sanitizeCommentText(id, "id", { maxLength: 160 });
    const normalizedAuthor = assertAuthorized(author, teamRoster);
    const existing = commentsById.get(commentId);

    if (!existing || existing.deletedAt) {
      throw new InternalCommentError("comment was not found", { id: commentId });
    }

    if (existing.author !== normalizedAuthor) {
      throw new InternalCommentError("only the author can update this comment", {
        id: commentId,
      });
    }

    const updated = {
      ...existing,
      body: sanitizeCommentText(body, "body", { maxLength: COMMENT_LIMITS.maxBodyLength }),
      updatedAt: now(),
    };

    commentsById.set(commentId, updated);
    return { ...updated, target: { ...updated.target } };
  }

  function deleteComment(id, author) {
    const commentId = sanitizeCommentText(id, "id", { maxLength: 160 });
    const normalizedAuthor = assertAuthorized(author, teamRoster);
    const existing = commentsById.get(commentId);

    if (!existing || existing.deletedAt) {
      throw new InternalCommentError("comment was not found", { id: commentId });
    }

    if (existing.author !== normalizedAuthor) {
      throw new InternalCommentError("only the author can delete this comment", {
        id: commentId,
      });
    }

    commentsById.set(commentId, {
      ...existing,
      deletedAt: now(),
    });
  }

  function buildExternalSafeSummary(target) {
    const comments = listComments(target);

    return {
      target: normalizeCommentTarget(target),
      internalCommentCount: comments.length,
      latestInternalCommentAt: comments.at(-1)?.createdAt ?? null,
      commentBodiesIncluded: false,
    };
  }

  return {
    addComment,
    listComments,
    updateComment,
    deleteComment,
    buildExternalSafeSummary,
  };
}
