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
