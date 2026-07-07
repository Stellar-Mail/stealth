export const REVIEW_FLAG_STATES = Object.freeze({
  LOADING: "loading",
  EMPTY: "empty",
  SUCCESS: "success",
  ERROR: "error",
});

export const DEFAULT_REVIEW_CONFIG = Object.freeze({
  highValueThreshold: 100000,
  reviewers: Object.freeze({
    legal: "Legal",
    compliance: "Compliance",
    finance: "Finance Operations",
    combined: "Legal and Compliance",
    owner: "Team Owner",
  }),
});

const SEVERITY_RANK = Object.freeze({
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
});

const LEGAL_TERMS = [
  "addendum",
  "contract",
  "data processing",
  "dpa",
  "indemnity",
  "liability",
  "msa",
  "nda",
  "procurement",
  "renewal terms",
  "termination",
  "terms of service",
];

const COMPLIANCE_TERMS = [
  "customer export",
  "gdpr",
  "health data",
  "hipaa",
  "passport",
  "personal data",
  "pii",
  "privacy",
  "regulated data",
  "ssn",
];

const SANCTIONS_TERMS = [
  "dual-use",
  "embargo",
  "export control",
  "restricted country",
  "sanction",
  "trade restriction",
];

const FINANCE_TERMS = [
  "chargeback",
  "invoice",
  "payment exception",
  "refund",
  "tax",
];

export function createReviewFlagReport(input = {}) {
  if (input?.isLoading) {
    return {
      state: REVIEW_FLAG_STATES.LOADING,
      status: "pending",
      items: [],
      flags: [],
      errors: [],
      summary: createEmptySummary(),
    };
  }

  const items = input?.items;
  if (!Array.isArray(items)) {
    return createErrorReport("items must be an array");
  }

  if (items.length === 0) {
    return {
      state: REVIEW_FLAG_STATES.EMPTY,
      status: "ready",
      items: [],
      flags: [],
      errors: [],
      summary: createEmptySummary(),
    };
  }

  const config = {
    ...DEFAULT_REVIEW_CONFIG,
    ...(input.config ?? {}),
    reviewers: {
      ...DEFAULT_REVIEW_CONFIG.reviewers,
      ...(input.config?.reviewers ?? {}),
    },
  };

  const errors = validateItems(items);
  if (errors.length > 0) {
    return createErrorReport(errors);
  }

  const evaluatedItems = items.map((item) => evaluateReviewItem(item, config));
  const summary = summarizeEvaluations(evaluatedItems);

  return {
    state: REVIEW_FLAG_STATES.SUCCESS,
    status: summary.criticalCount > 0
      ? "blocked"
      : summary.flaggedItems > 0
        ? "review_required"
        : "clear",
    items: evaluatedItems,
    flags: summarizeFlags(evaluatedItems),
    errors: [],
    summary,
  };
}

export function evaluateReviewItem(item, config = DEFAULT_REVIEW_CONFIG) {
  const normalizedConfig = {
    ...DEFAULT_REVIEW_CONFIG,
    ...config,
    reviewers: {
      ...DEFAULT_REVIEW_CONFIG.reviewers,
      ...(config.reviewers ?? {}),
    },
  };

  const searchableText = normalizeSearchText(item);
  const contractValue = normalizeMoney(item.contractValue);
  const hasExternalData = item.containsExternalData === true;
  const hasAssignedReviewer = hasAnyValue(item, [
    "reviewer",
    "legalOwner",
    "complianceOwner",
    "approvedBy",
  ]);

  const flags = [];
  const legalMatches = findMatches(searchableText, LEGAL_TERMS);
  if (legalMatches.length > 0) {
    flags.push(createFlag({
      code: "legal_review_required",
      label: "Legal review required",
      severity: contractValue >= normalizedConfig.highValueThreshold ? "high" : "medium",
      reason: "The item references contract or legal terms that should be reviewed before response.",
      evidence: legalMatches,
    }));
  }

  const complianceMatches = findMatches(searchableText, COMPLIANCE_TERMS);
  if (hasExternalData || complianceMatches.length > 0) {
    flags.push(createFlag({
      code: "compliance_risk",
      label: "Compliance risk",
      severity: "high",
      reason: "The item may involve regulated, personal, or external customer data.",
      evidence: hasExternalData ? ["containsExternalData"] : complianceMatches,
    }));
  }

  const sanctionsMatches = findMatches(searchableText, SANCTIONS_TERMS);
  if (sanctionsMatches.length > 0) {
    flags.push(createFlag({
      code: "sanctions_export_review",
      label: "Sanctions or export review",
      severity: "critical",
      reason: "The item references sanctions, restricted jurisdictions, or export-control concerns.",
      evidence: sanctionsMatches,
    }));
  }

  const financeMatches = findMatches(searchableText, FINANCE_TERMS);
  if (financeMatches.length > 0) {
    flags.push(createFlag({
      code: "finance_review_required",
      label: "Finance review required",
      severity: "medium",
      reason: "The item references payment, tax, invoice, refund, or chargeback handling.",
      evidence: financeMatches,
    }));
  }

  if ((contractValue >= normalizedConfig.highValueThreshold || hasExternalData) && !hasAssignedReviewer) {
    flags.push(createFlag({
      code: "missing_approval",
      label: "Missing owner or reviewer",
      severity: contractValue >= normalizedConfig.highValueThreshold && hasExternalData
        ? "critical"
        : "high",
      reason: "The item needs an accountable reviewer before the team responds.",
      evidence: [
        contractValue >= normalizedConfig.highValueThreshold ? "highValueContract" : null,
        hasExternalData ? "externalData" : null,
      ].filter(Boolean),
    }));
  }

  const severity = flags.length > 0 ? highestSeverity(flags.map((flag) => flag.severity)) : "low";

  return {
    id: item.id,
    title: item.subject ?? item.title,
    status: flags.length > 0 ? "needs_review" : "clear",
    severity,
    recommendedReviewer: chooseReviewer(flags, normalizedConfig.reviewers),
    flags,
    metadata: {
      contractValue,
      containsExternalData: hasExternalData,
      requestedAction: item.requestedAction ?? null,
    },
  };
}

function createFlag({ code, label, severity, reason, evidence }) {
  return {
    code,
    label,
    severity,
    reason,
    evidence: [...new Set(evidence)].sort(),
  };
}

function createEmptySummary() {
  return {
    totalItems: 0,
    flaggedItems: 0,
    clearItems: 0,
    highestSeverity: "low",
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
  };
}

function createErrorReport(messages) {
  return {
    state: REVIEW_FLAG_STATES.ERROR,
    status: "blocked",
    items: [],
    flags: [],
    errors: Array.isArray(messages) ? messages : [messages],
    summary: createEmptySummary(),
  };
}

function validateItems(items) {
  const errors = [];
  items.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      errors.push(`items[${index}] must be an object`);
      return;
    }

    if (!isNonEmptyString(item.id)) {
      errors.push(`items[${index}].id is required`);
    }

    if (!isNonEmptyString(item.subject) && !isNonEmptyString(item.title)) {
      errors.push(`items[${index}].subject or items[${index}].title is required`);
    }
  });

  return errors;
}

function summarizeEvaluations(items) {
  const severityCounts = items.reduce((counts, item) => {
    counts[item.severity] += 1;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0 });

  return {
    totalItems: items.length,
    flaggedItems: items.filter((item) => item.flags.length > 0).length,
    clearItems: items.filter((item) => item.flags.length === 0).length,
    highestSeverity: highestSeverity(items.map((item) => item.severity)),
    criticalCount: severityCounts.critical,
    highCount: severityCounts.high,
    mediumCount: severityCounts.medium,
    lowCount: severityCounts.low,
  };
}

function summarizeFlags(items) {
  const counts = new Map();
  for (const item of items) {
    for (const flag of item.flags) {
      const current = counts.get(flag.code) ?? {
        code: flag.code,
        label: flag.label,
        severity: flag.severity,
        count: 0,
      };
      current.count += 1;
      current.severity = highestSeverity([current.severity, flag.severity]);
      counts.set(flag.code, current);
    }
  }

  return [...counts.values()].sort((a, b) => {
    if (SEVERITY_RANK[b.severity] !== SEVERITY_RANK[a.severity]) {
      return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    }
    return a.code.localeCompare(b.code);
  });
}

function chooseReviewer(flags, reviewers) {
  const codes = new Set(flags.map((flag) => flag.code));
  if (codes.has("sanctions_export_review")) {
    return reviewers.combined;
  }

  if (codes.has("compliance_risk") && codes.has("legal_review_required")) {
    return reviewers.combined;
  }

  if (codes.has("compliance_risk")) {
    return reviewers.compliance;
  }

  if (codes.has("legal_review_required") || codes.has("missing_approval")) {
    return reviewers.legal;
  }

  if (codes.has("finance_review_required")) {
    return reviewers.finance;
  }

  return reviewers.owner;
}

function highestSeverity(severities) {
  return severities.reduce((highest, severity) => (
    SEVERITY_RANK[severity] > SEVERITY_RANK[highest] ? severity : highest
  ), "low");
}

function normalizeSearchText(item) {
  return [
    item.subject,
    item.title,
    item.body,
    item.requestedAction,
    Array.isArray(item.tags) ? item.tags.join(" ") : "",
    Array.isArray(item.attachments) ? item.attachments.map((attachment) => attachment.name).join(" ") : "",
  ].filter(Boolean).join(" ").toLowerCase();
}

function findMatches(text, terms) {
  return terms.filter((term) => {
    const pattern = new RegExp(`\\b${escapeRegex(term).replace(/\s+/g, "\\s+")}\\b`, "i");
    return pattern.test(text);
  });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeMoney(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

function hasAnyValue(item, keys) {
  return keys.some((key) => isNonEmptyString(item[key]));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
