// Minimal, deterministic digest generator service (zero-deps)

function idFrom(email) {
  return `${email.threadId || 't'}-${email.id}`;
}

export function classifyItem(email) {
  const subj = (email.subject || '').toLowerCase();
  const body = (email.body || '').toLowerCase();

  if (subj.includes('summary') || email.tags?.summary) return 'team_summary';
  if (subj.includes('completed') || subj.includes('done') || email.tags?.status === 'completed') return 'completed_item';
  if (subj.includes('todo') || subj.includes('action') || body.includes('action required') || email.tags?.requiresAction) return 'pending_item';
  return 'new_message';
}

export function inferPriority(email) {
  const text = ((email.subject || '') + ' ' + (email.body || '')).toLowerCase();
  const highSignals = ['urgent', 'asap', 'immediately', 'priority', 'blocked'];
  const mediumSignals = ['please', 'review', 'attention', 'when you can'];

  if (highSignals.some(s => text.includes(s))) return 'high';
  if (mediumSignals.some(s => text.includes(s))) return 'medium';
  return 'low';
}

export function requiresAttention(email) {
  const type = classifyItem(email);
  const priority = inferPriority(email);
  if (priority === 'high') return true;
  if (type === 'pending_item' && priority !== 'low') return true;
  // explicit flags in fixture
  if (email.flags?.needsAttention) return true;
  return false;
}

export function buildSummary(items) {
  const total = items.length;
  const attentionCount = items.filter(i => i.requiresAttention).length;
  const distinctTeamMembers = [...new Set(items.map(i => i.sender))].length;
  const byType = items.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {});

  return { total, attentionCount, distinctTeamMembers, byType };
}

export function generateDigest(activity, date, generatedAt = new Date().toISOString()) {
  if (!activity || !Array.isArray(activity.emails)) throw new Error('activity.emails array required');
  const items = activity.emails.map(email => {
    const type = classifyItem(email);
    const priority = inferPriority(email);
    const needs = requiresAttention(email);

    return {
      id: idFrom(email),
      threadId: email.threadId || null,
      messageId: email.id,
      sender: email.from || 'unknown',
      recipients: email.to || [],
      subject: email.subject || '',
      snippet: (email.body || '').slice(0, 240),
      date: email.date || null,
      type,
      priority,
      requiresAttention: needs,
    };
  });

  const summary = buildSummary(items);

  return {
    date,
    generatedAt,
    items,
    summary,
  };
}

export default { generateDigest, classifyItem, inferPriority, requiresAttention, buildSummary };
const ALLOWED_TYPES = new Set(["new_message", "pending_item", "completed_item", "team_summary"]);
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

function classifyItem(email) {
  const signals = email.signals ?? [];

  if (
    signals.some((s) => s.includes("completed") || s.includes("fixed") || s.includes("deployed"))
  ) {
    return "completed_item";
  }

  if (
    signals.some((s) => s.includes("sprint") || s.includes("planning") || s.includes("roadmap"))
  ) {
    return "team_summary";
  }

  if (
    signals.some(
      (s) => s.includes("blocked") || s.includes("needs") || s.includes("action required"),
    )
  ) {
    return "pending_item";
  }

  return "new_message";
}

function extractTeamMember(email) {
  const localPart = email.from.split("@")[0];
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function inferPriority(email) {
  const signals = email.signals ?? [];

  if (
    signals.some(
      (s) =>
        s.includes("blocked") ||
        s.includes("failed") ||
        s.includes("action required") ||
        s.includes("security"),
    )
  ) {
    return "high";
  }

  if (signals.some((s) => s.includes("needs review") || s.includes("PR ready"))) {
    return "medium";
  }

  return "low";
}

function requiresAttention(email) {
  const signals = email.signals ?? [];
  const priority = inferPriority(email);

  if (priority === "high") return true;
  if (signals.some((s) => s.includes("needs") || s.includes("action required"))) return true;

  return false;
}

function buildDigestItem(email) {
  const type = classifyItem(email);
  const teamMember = extractTeamMember(email);
  const priority = inferPriority(email);
  const attention = requiresAttention(email);

  // Make a deterministic ID from the email
  const id = `digest-${email.id.replace(/^email-/, "")}`;

  return {
    id,
    type,
    title: email.subject,
    sourceEmailId: email.id,
    teamMember,
    priority,
    timestamp: email.receivedAt,
    requiresAttention: attention,
  };
}

function buildSummary(items) {
  const memberSet = new Set(items.map((i) => i.teamMember));

  return {
    totalItems: items.length,
    requiresAttention: items.filter((i) => i.requiresAttention).length,
    teamMembers: [...memberSet],
  };
}

export function generateDigest(activity, date, generatedAt) {
  if (!Array.isArray(activity)) {
    throw new Error("activity must be an array");
  }

  const items = activity.map(buildDigestItem);
  const summary = buildSummary(items);

  return {
    date,
    generatedAt: generatedAt ?? new Date().toISOString(),
    team: "Engineering",
    items,
    summary,
  };
}
