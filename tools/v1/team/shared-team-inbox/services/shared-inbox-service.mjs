const MESSAGE_STATUSES = ["unassigned", "claimed", "in-progress", "awaiting-reply", "resolved"];
const VALID_TRANSITIONS = {
  unassigned: new Set(["claimed", "in-progress"]),
  claimed: new Set(["unassigned", "in-progress", "awaiting-reply", "resolved"]),
  "in-progress": new Set(["awaiting-reply", "resolved", "claimed"]),
  "awaiting-reply": new Set(["in-progress", "resolved"]),
  resolved: new Set(["in-progress"]),
};

const LIMITS = {
  MAX_MESSAGE_BODY_LENGTH: 20_000,
  MAX_COMMENT_LENGTH: 4_000,
  MAX_REPLY_LENGTH: 20_000,
  MAX_TEAM_SIZE: 100,
};

export class SharedInboxError extends Error {
  constructor(message, code, field) {
    super(message);
    this.name = "SharedInboxError";
    this.code = code;
    this.field = field;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, maxLength = Number.POSITIVE_INFINITY) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function assertPlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SharedInboxError(`${field} must be a plain object`, "invalid-input", field);
  }
}

function validateEmailAddress(value, field) {
  const email = cleanText(value);
  if (!email) {
    throw new SharedInboxError(`${field} is required`, "missing-field", field);
  }
  if (/[\r\n\0]/.test(email)) {
    throw new SharedInboxError(`${field} contains unsafe control characters`, "unsafe-input", field);
  }
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) {
    throw new SharedInboxError(`${field} must be an email-like address`, "invalid-input", field);
  }
  return email;
}

function validateTeamRoster(teamMembers = []) {
  if (!Array.isArray(teamMembers)) {
    throw new SharedInboxError("teamMembers must be an array", "invalid-input", "teamMembers");
  }
  if (teamMembers.length > LIMITS.MAX_TEAM_SIZE) {
    throw new SharedInboxError("teamMembers exceeds safe team size", "too-large", "teamMembers");
  }
  return teamMembers.map((member) => validateEmailAddress(member, "teamMembers"));
}

function validateStatus(status) {
  if (!MESSAGE_STATUSES.includes(status)) {
    throw new SharedInboxError(`unsupported status: ${status}`, "invalid-status", "status");
  }
  return status;
}

function normalizeMessage(input) {
  assertPlainObject(input, "message");
  const id = cleanText(input.id);
  const deliveryProofHash = cleanText(input.deliveryProofHash);
  const subject = cleanText(input.subject, 998);
  const body = cleanText(input.body, LIMITS.MAX_MESSAGE_BODY_LENGTH);

  if (!id) {
    throw new SharedInboxError("message id is required", "missing-field", "id");
  }
  if (!deliveryProofHash) {
    throw new SharedInboxError(
      "deliveryProofHash is required",
      "missing-field",
      "deliveryProofHash",
    );
  }
  if (!subject) {
    throw new SharedInboxError("subject is required", "missing-field", "subject");
  }
  if (!body) {
    throw new SharedInboxError("body is required", "missing-field", "body");
  }

  return {
    id,
    deliveryProofHash,
    sharedInboxAddress: validateEmailAddress(input.sharedInboxAddress, "sharedInboxAddress"),
    senderAddress: validateEmailAddress(input.senderAddress, "senderAddress"),
    subject,
    body,
    receivedAt: cleanText(input.receivedAt) || new Date(0).toISOString(),
    status: validateStatus(input.status ?? "unassigned"),
    assignee: input.assignee ? validateEmailAddress(input.assignee, "assignee") : null,
    comments: [],
    replies: [],
  };
}

function recordActivity(state, type, messageId, actor, details = {}) {
  state.activityCount += 1;
  const activity = {
    id: `activity-${String(state.activityCount).padStart(3, "0")}`,
    type,
    messageId,
    actor,
    at: new Date().toISOString(),
    details,
  };
  state.activities.push(activity);
  return activity;
}

function createState(teamMembers = []) {
  return {
    teamMembers: validateTeamRoster(teamMembers),
    messages: new Map(),
    proofHashes: new Map(),
    activities: [],
    activityCount: 0,
  };
}

function getMessageOrThrow(state, messageId) {
  const message = state.messages.get(messageId);
  if (!message) {
    throw new SharedInboxError(`message not found: ${messageId}`, "not-found", "messageId");
  }
  return message;
}

function assertTeamMember(state, actor) {
  const normalized = validateEmailAddress(actor, "actor");
  if (!state.teamMembers.includes(normalized)) {
    throw new SharedInboxError("actor is not in the team roster", "unauthorized", "actor");
  }
  return normalized;
}

function assertTransition(from, to) {
  validateStatus(from);
  validateStatus(to);
  if (from === to) {
    return true;
  }
  if (!VALID_TRANSITIONS[from].has(to)) {
    throw new SharedInboxError(
      `invalid status transition: ${from} -> ${to}`,
      "invalid-transition",
      "status",
    );
  }
  return true;
}

function listMessages(state, filters = {}) {
  let messages = [...state.messages.values()];
  if (filters.status) {
    validateStatus(filters.status);
    messages = messages.filter((message) => message.status === filters.status);
  }
  if (filters.assignee) {
    const assignee = validateEmailAddress(filters.assignee, "assignee");
    messages = messages.filter((message) => message.assignee === assignee);
  }
  return messages
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .map((message) => clone(message));
}

export function createSharedInboxService(options = {}) {
  const state = createState(options.teamMembers ?? []);

  return {
    getState() {
      return {
        teamMembers: clone(state.teamMembers),
        messages: listMessages(state),
        activities: clone(state.activities),
      };
    },

    ingestMessage(input) {
      const message = normalizeMessage(input);
      const existingId = state.proofHashes.get(message.deliveryProofHash);

      if (existingId) {
        return {
          status: "duplicate",
          loading: false,
          error: null,
          message: clone(state.messages.get(existingId)),
        };
      }

      state.messages.set(message.id, message);
      state.proofHashes.set(message.deliveryProofHash, message.id);
      recordActivity(state, "message-ingested", message.id, "system");

      return {
        status: "stored",
        loading: false,
        error: null,
        message: clone(message),
      };
    },

    listMessages(filters = {}) {
      return {
        loading: false,
        error: null,
        messages: listMessages(state, filters),
      };
    },

    claimMessage(messageId, actor, note = "") {
      const member = assertTeamMember(state, actor);
      const message = getMessageOrThrow(state, messageId);
      if (message.status === "resolved") {
        throw new SharedInboxError("resolved messages must be reopened before claiming", "invalid-transition", "status");
      }
      message.assignee = member;
      message.status = "claimed";
      recordActivity(state, "message-claimed", message.id, member, { note: cleanText(note) });
      return clone(message);
    },

    releaseMessage(messageId, actor) {
      const member = assertTeamMember(state, actor);
      const message = getMessageOrThrow(state, messageId);
      assertTransition(message.status, "unassigned");
      message.assignee = null;
      message.status = "unassigned";
      recordActivity(state, "message-released", message.id, member);
      return clone(message);
    },

    updateStatus(messageId, actor, nextStatus) {
      const member = assertTeamMember(state, actor);
      const message = getMessageOrThrow(state, messageId);
      const status = validateStatus(nextStatus);
      assertTransition(message.status, status);
      message.status = status;
      recordActivity(state, "status-updated", message.id, member, { status });
      return clone(message);
    },

    addInternalComment(messageId, actor, body) {
      const member = assertTeamMember(state, actor);
      const message = getMessageOrThrow(state, messageId);
      const text = cleanText(body, LIMITS.MAX_COMMENT_LENGTH);
      if (!text) {
        throw new SharedInboxError("comment body is required", "missing-field", "body");
      }
      const comment = {
        id: `comment-${message.id}-${message.comments.length + 1}`,
        author: member,
        body: text,
        visibility: "team-only",
        createdAt: new Date().toISOString(),
        deleted: false,
      };
      message.comments.push(comment);
      recordActivity(state, "comment-added", message.id, member, { commentId: comment.id });
      return clone(comment);
    },

    sendReply(messageId, actor, body) {
      const member = assertTeamMember(state, actor);
      const message = getMessageOrThrow(state, messageId);
      const text = cleanText(body, LIMITS.MAX_REPLY_LENGTH);
      if (!text) {
        throw new SharedInboxError("reply body is required", "missing-field", "body");
      }
      if (!message.assignee) {
        throw new SharedInboxError("message must be claimed before replying", "invalid-state", "assignee");
      }
      const reply = {
        id: `reply-${message.id}-${message.replies.length + 1}`,
        from: message.sharedInboxAddress,
        to: message.senderAddress,
        body: text,
        sentBy: member,
        sentAt: new Date().toISOString(),
      };
      message.replies.push(reply);
      message.status = "resolved";
      recordActivity(state, "reply-sent", message.id, member, { replyId: reply.id });
      return clone(reply);
    },
  };
}

export { LIMITS, MESSAGE_STATUSES, VALID_TRANSITIONS, normalizeMessage };
