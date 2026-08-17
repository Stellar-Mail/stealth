/**
 * Headless, framework-agnostic view-model for the Team Security Flagging
 * triage queue (issue #701 - UI and accessibility surface).
 *
 * This module renders nothing. It maps the tool's loading/data/error state into
 * a presentation-independent "view" object that any renderer (web, native, CLI
 * or a test harness) can consume. Accessibility is encoded in the view data
 * itself - ARIA roles, live-region politeness, accessible names, focus targets
 * and a keyboard interaction map - so it cannot be dropped at render time.
 *
 * It is intentionally NOT mounted in the main app and imports nothing from
 * outside this tool folder.
 */

/** Local, tool-scoped severity presentation. Not the shared design system. */
export const SEVERITY_PRESENTATION = Object.freeze({
  critical: { label: "Critical", srLabel: "Critical severity", order: 0, tone: "sev-critical" },
  high: { label: "High", srLabel: "High severity", order: 1, tone: "sev-high" },
  medium: { label: "Medium", srLabel: "Medium severity", order: 2, tone: "sev-medium" },
  low: { label: "Low", srLabel: "Low severity", order: 3, tone: "sev-low" },
});

/** Local, tool-scoped status presentation, aligned with the status lifecycle. */
export const STATUS_PRESENTATION = Object.freeze({
  new: { label: "New", description: "Reported and awaiting triage.", isTerminal: false },
  "under-review": {
    label: "Under review",
    description: "A reviewer is actively assessing the flag.",
    isTerminal: false,
  },
  escalated: {
    label: "Escalated",
    description: "Raised to a higher tier for response.",
    isTerminal: false,
  },
  resolved: {
    label: "Resolved",
    description: "Closed after handling. Terminal state.",
    isTerminal: true,
  },
  dismissed: {
    label: "Dismissed",
    description: "Closed as not actionable. Terminal state.",
    isTerminal: true,
  },
});

export const CATEGORY_LABELS = Object.freeze({
  phishing: "Phishing",
  "credential-theft": "Credential theft",
  malware: "Malware",
  "data-breach": "Data breach",
  "suspicious-sender": "Suspicious sender",
  "unauthorized-access": "Unauthorized access",
  "social-engineering": "Social engineering",
  other: "Other",
});

/** Keyboard interaction map for the queue (documented in UI_AND_ACCESSIBILITY.md). */
export const QUEUE_KEYBOARD_SHORTCUTS = Object.freeze([
  { keys: ["ArrowDown"], action: "focus-next", description: "Move focus to the next flag." },
  { keys: ["ArrowUp"], action: "focus-previous", description: "Move focus to the previous flag." },
  { keys: ["Home"], action: "focus-first", description: "Move focus to the first flag." },
  { keys: ["End"], action: "focus-last", description: "Move focus to the last flag." },
  { keys: ["Enter", " "], action: "open", description: "Open the focused flag for review." },
  { keys: ["e"], action: "escalate", description: "Escalate the focused flag." },
  { keys: ["r"], action: "resolve", description: "Resolve the focused flag." },
  { keys: ["d"], action: "dismiss", description: "Dismiss the focused flag." },
  { keys: ["/"], action: "search", description: "Move focus to the queue search field." },
  { keys: ["Escape"], action: "clear-selection", description: "Clear the current selection." },
]);

const QUEUE_HEADING = "Security flag queue";
const QUEUE_REGION_LABEL = "Security flag triage queue";

const emptySeverityCounts = () => ({ critical: 0, high: 0, medium: 0, low: 0 });
const emptyStatusCounts = () => ({
  new: 0,
  "under-review": 0,
  escalated: 0,
  resolved: 0,
  dismissed: 0,
});

export const describeSeverity = (severity) =>
  SEVERITY_PRESENTATION[severity] ?? {
    label: "Unknown",
    srLabel: "Unknown severity",
    order: 99,
    tone: "sev-unknown",
  };

export const describeStatus = (status) =>
  STATUS_PRESENTATION[status] ?? {
    label: "Unknown",
    description: "Unrecognized status.",
    isTerminal: false,
  };

export const describeCategory = (category) => CATEGORY_LABELS[category] ?? "Other";

/** Build a single accessible row view for a flag. */
export const buildFlagRowView = (flag, index, focusableIndex) => {
  const severity = describeSeverity(flag.severity);
  const status = describeStatus(flag.status);
  const categoryLabel = describeCategory(flag.category);
  const isFocusable = index === focusableIndex;
  return {
    id: flag.id,
    rowId: `flag-row-${flag.id}`,
    tabIndex: isFocusable ? 0 : -1,
    selected: isFocusable,
    ariaLabel: `${severity.srLabel} ${categoryLabel} flag: "${flag.subject}" from ${flag.senderEmail}. Status: ${status.label}.`,
    subject: flag.subject,
    senderEmail: flag.senderEmail,
    severity: { value: flag.severity, ...severity },
    status: { value: flag.status, ...status },
    category: { value: flag.category, label: categoryLabel },
  };
};

const summarize = (flags) => {
  const bySeverity = emptySeverityCounts();
  const byStatus = emptyStatusCounts();
  for (const flag of flags) {
    if (flag.severity in bySeverity) bySeverity[flag.severity] += 1;
    if (flag.status in byStatus) byStatus[flag.status] += 1;
  }
  return { total: flags.length, bySeverity, byStatus };
};

const baseView = (overrides) => ({
  heading: QUEUE_HEADING,
  keyboardShortcuts: QUEUE_KEYBOARD_SHORTCUTS,
  ...overrides,
});

/**
 * Map the tool state into a fully accessible, render-agnostic queue view.
 */
export const buildFlagQueueView = (input) => {
  const phase = input?.phase ?? "loading";

  if (phase === "loading") {
    return baseView({
      state: "loading",
      region: { role: "region", ariaLabel: QUEUE_REGION_LABEL, ariaLive: "polite", ariaBusy: true },
      announcement: "Loading security flags...",
      focusTargetId: "flag-queue-status",
    });
  }

  if (phase === "error") {
    const message = input?.error?.message ?? "Something went wrong while loading security flags.";
    return baseView({
      state: "error",
      region: {
        role: "alert",
        ariaLabel: QUEUE_REGION_LABEL,
        ariaLive: "assertive",
        ariaBusy: false,
      },
      announcement: `Could not load security flags. ${message}`,
      focusTargetId: "flag-queue-retry",
      error: { code: input?.error?.code, message, retryActionId: "flag-queue-retry" },
    });
  }

  const flags = Array.isArray(input?.flags) ? input.flags : [];

  if (flags.length === 0) {
    return baseView({
      state: "empty",
      region: {
        role: "region",
        ariaLabel: QUEUE_REGION_LABEL,
        ariaLive: "polite",
        ariaBusy: false,
      },
      announcement: "No security flags to review.",
      guidance:
        "There are no security flags in the queue. New reports will appear here automatically.",
      focusTargetId: "flag-queue-empty-cta",
    });
  }

  const selectedIndex = input?.selectedFlagId
    ? flags.findIndex((flag) => flag.id === input.selectedFlagId)
    : 0;
  const focusableIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const items = flags.map((flag, index) => buildFlagRowView(flag, index, focusableIndex));

  return baseView({
    state: "success",
    region: { role: "region", ariaLabel: QUEUE_REGION_LABEL, ariaLive: "polite", ariaBusy: false },
    announcement: `${flags.length} security ${flags.length === 1 ? "flag" : "flags"} to review.`,
    focusTargetId: items[focusableIndex]?.rowId ?? items[0].rowId,
    items,
    summary: summarize(flags),
  });
};
