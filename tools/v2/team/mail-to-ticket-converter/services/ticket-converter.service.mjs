export const TICKET_CONVERTER_STATES = Object.freeze({
  LOADING: "loading",
  EMPTY: "empty",
  SUCCESS: "success",
  ERROR: "error",
});

export const DEFAULT_CONVERTER_CONFIG = Object.freeze({
  ticketIdPrefix: "ticket",
  titleMaxLength: 96,
  descriptionMaxLength: 320,
  slaHours: Object.freeze({
    critical: 4,
    high: 24,
    medium: 72,
    low: 168,
  }),
  queues: Object.freeze({
    access: "Access Support",
    billing: "Billing Operations",
    bug: "Product Support",
    feature: "Product Feedback",
    security: "Security Response",
    support: "Customer Support",
  }),
});

const PRIORITY_RANK = Object.freeze({
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
});

const CATEGORY_RULES = Object.freeze({
  security: ["breach", "compromised", "phishing", "security incident", "suspicious login"],
  billing: ["billing", "charge", "invoice", "payment", "refund", "subscription"],
  access: ["access", "locked out", "login", "password", "permission", "sign in"],
  bug: ["bug", "broken", "error", "exception", "failing", "regression"],
  feature: ["feature request", "improvement", "roadmap", "suggestion"],
});

const PRIORITY_RULES = Object.freeze({
  critical: ["breach", "data loss", "outage", "production down", "security incident", "severity 1"],
  high: ["asap", "blocked", "cannot access", "deadline", "urgent", "vip"],
  medium: [
    "billing",
    "bug",
    "customer question",
    "feature request",
    "follow up",
    "help",
    "invoice",
    "issue",
    "payment",
    "refund",
  ],
});

export function createTicketConversionReport(input = {}) {
  if (input?.isLoading) {
    return {
      state: TICKET_CONVERTER_STATES.LOADING,
      status: "pending",
      tickets: [],
      errors: [],
      summary: createEmptySummary(),
    };
  }

  const messages = input?.messages;
  if (!Array.isArray(messages)) {
    return createErrorReport("messages must be an array");
  }

  if (messages.length === 0) {
    return {
      state: TICKET_CONVERTER_STATES.EMPTY,
      status: "ready",
      tickets: [],
      errors: [],
      summary: createEmptySummary(),
    };
  }

  const errors = validateMessages(messages);
  if (errors.length > 0) {
    return createErrorReport(errors);
  }

  const config = normalizeConfig(input.config);
  const tickets = messages.map((message, index) => convertMailToTicket(message, {
    ...config,
    index,
  }));

  return {
    state: TICKET_CONVERTER_STATES.SUCCESS,
    status: "converted",
    tickets,
    errors: [],
    summary: summarizeTickets(tickets),
  };
}

export function convertMailToTicket(message, config = DEFAULT_CONVERTER_CONFIG) {
  const normalizedConfig = normalizeConfig(config);
  const text = normalizeSearchText(message);
  const category = detectCategory(text);
  const priority = detectPriority(text, message);
  const title = normalizeTitle(message.subject ?? message.title, normalizedConfig.titleMaxLength);
  const description = buildDescription(message, normalizedConfig.descriptionMaxLength);
  const queue = normalizedConfig.queues[category] ?? normalizedConfig.queues.support;
  const tags = buildTags(message, category, priority);

  return {
    id: `${normalizedConfig.ticketIdPrefix}-${message.id}`,
    title,
    description,
    category,
    priority,
    queue,
    status: "ready_for_review",
    confidence: calculateConfidence(category, priority, text),
    slaHours: normalizedConfig.slaHours[priority],
    tags,
    source: {
      messageId: message.id,
      threadId: message.threadId ?? null,
      senderName: message.senderName ?? null,
      senderEmail: message.senderEmail ?? null,
      receivedAt: message.receivedAt ?? null,
      attachmentsCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
    },
  };
}

function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_CONVERTER_CONFIG,
    ...config,
    slaHours: {
      ...DEFAULT_CONVERTER_CONFIG.slaHours,
      ...(config.slaHours ?? {}),
    },
    queues: {
      ...DEFAULT_CONVERTER_CONFIG.queues,
      ...(config.queues ?? {}),
    },
  };
}

function validateMessages(messages) {
  const errors = [];
  messages.forEach((message, index) => {
    if (!message || typeof message !== "object") {
      errors.push(`messages[${index}] must be an object`);
      return;
    }

    if (!isNonEmptyString(message.id)) {
      errors.push(`messages[${index}].id is required`);
    }

    if (!isNonEmptyString(message.subject) && !isNonEmptyString(message.title)) {
      errors.push(`messages[${index}].subject or messages[${index}].title is required`);
    }
  });

  return errors;
}

function detectCategory(text) {
  for (const [category, terms] of Object.entries(CATEGORY_RULES)) {
    if (findMatches(text, terms).length > 0) {
      return category;
    }
  }

  return "support";
}

function detectPriority(text, message) {
  if (message.isVip === true || hasLabel(message, "vip")) {
    return "high";
  }

  for (const priority of ["critical", "high", "medium"]) {
    if (findMatches(text, PRIORITY_RULES[priority]).length > 0) {
      return priority;
    }
  }

  return "low";
}

function normalizeTitle(value, maxLength) {
  const cleaned = value
    .replace(/^\s*(re|fw|fwd):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}...`;
}

function buildDescription(message, maxLength) {
  const body = isNonEmptyString(message.body) ? message.body : "No message body provided.";
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}...`;
}

function buildTags(message, category, priority) {
  const tags = new Set([category, priority, "mail-import"]);
  if (Array.isArray(message.labels)) {
    message.labels
      .filter(isNonEmptyString)
      .map((label) => label.trim().toLowerCase().replace(/\s+/g, "-"))
      .forEach((label) => tags.add(label));
  }

  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    tags.add("has-attachments");
  }

  if (message.isVip === true) {
    tags.add("vip");
  }

  return [...tags].sort();
}

function calculateConfidence(category, priority, text) {
  const categoryMatched = category !== "support";
  const priorityMatched = priority !== "low";
  if (priority === "critical" && categoryMatched) {
    return 0.95;
  }

  if (categoryMatched && priorityMatched) {
    return 0.9;
  }

  if (categoryMatched || priorityMatched || text.length > 80) {
    return 0.8;
  }

  return 0.65;
}

function summarizeTickets(tickets) {
  const summary = {
    totalMessages: tickets.length,
    convertedTickets: tickets.length,
    highestPriority: highestPriority(tickets.map((ticket) => ticket.priority)),
    categories: {},
    priorities: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
  };

  for (const ticket of tickets) {
    summary.categories[ticket.category] = (summary.categories[ticket.category] ?? 0) + 1;
    summary.priorities[ticket.priority] += 1;
  }

  summary.categories = Object.fromEntries(Object.entries(summary.categories).sort());
  return summary;
}

function createEmptySummary() {
  return {
    totalMessages: 0,
    convertedTickets: 0,
    highestPriority: "low",
    categories: {},
    priorities: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
  };
}

function createErrorReport(messages) {
  return {
    state: TICKET_CONVERTER_STATES.ERROR,
    status: "blocked",
    tickets: [],
    errors: Array.isArray(messages) ? messages : [messages],
    summary: createEmptySummary(),
  };
}

function highestPriority(priorities) {
  return priorities.reduce((highest, priority) => (
    PRIORITY_RANK[priority] > PRIORITY_RANK[highest] ? priority : highest
  ), "low");
}

function normalizeSearchText(message) {
  return [
    message.subject,
    message.title,
    message.body,
    message.senderEmail,
    message.senderName,
    Array.isArray(message.labels) ? message.labels.join(" ") : "",
  ].filter(Boolean).join(" ").toLowerCase();
}

function findMatches(text, terms) {
  return terms.filter((term) => {
    const pattern = new RegExp(`\\b${escapeRegex(term).replace(/\s+/g, "\\s+")}\\b`, "i");
    return pattern.test(text);
  });
}

function hasLabel(message, label) {
  return Array.isArray(message.labels)
    && message.labels.some((entry) => entry.toLowerCase() === label.toLowerCase());
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
