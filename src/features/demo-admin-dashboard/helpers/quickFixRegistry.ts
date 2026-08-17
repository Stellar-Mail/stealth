import type { Draft } from "../types/draft";
import type {
  QuickFix,
  QuickFixApplication,
  QuickFixKind,
  QuickFixRegistry,
} from "../types/quickFix";
import type { ValidationIssue } from "../validation-types";

/** Safe, deterministic placeholders used by the quick fixes. */
export const SAFE_SUBJECT = "Untitled demo draft";
export const SAFE_BODY = "Draft content pending review.";
export const SAFE_RECIPIENT = "demo@example.com";

/** Rewrite any address into a safe demo address on example.com. */
export function toSafeRecipient(value: string): string {
  const [rawLocal = ""] = value.trim().split(/[@*]/);
  const localPart = rawLocal.replace(/[^a-zA-Z0-9._-]/g, "");
  const safeLocal = localPart.length > 0 ? localPart : "demo";
  return `${safeLocal.toLowerCase()}@example.com`;
}

function recipientIndexFromPath(fieldPath: string): number | null {
  const match = fieldPath.match(/recipients\[(\d+)\]/);
  if (!match) {
    return null;
  }
  const raw = match[1];
  if (raw === undefined) {
    return null;
  }
  return Number(raw);
}

const QUICK_FIXES: QuickFix[] = [
  {
    kind: "fill-subject",
    label: "Add placeholder subject",
    apply: (draft) => ({ ...draft, subject: SAFE_SUBJECT }),
  },
  {
    kind: "fill-body",
    label: "Add placeholder body",
    apply: (draft) => ({ ...draft, body: SAFE_BODY }),
  },
  {
    kind: "add-recipient",
    label: "Add safe demo recipient",
    apply: (draft) =>
      draft.recipients.length > 0 ? draft : { ...draft, recipients: [SAFE_RECIPIENT] },
  },
  {
    kind: "replace-unsafe-recipient",
    label: "Replace with safe demo address",
    apply: (draft, issue) => {
      const index = recipientIndexFromPath(issue.fieldPath);
      if (index === null || index < 0 || index >= draft.recipients.length) {
        return draft;
      }
      const recipients = draft.recipients.map((recipient, i) =>
        i === index ? toSafeRecipient(recipient) : recipient,
      );
      return { ...draft, recipients };
    },
  },
];

/** Map a validation issue to the quick-fix kind that resolves it, if any. */
export function quickFixKindForIssue(issue: ValidationIssue): QuickFixKind | undefined {
  if (issue.id.endsWith("-subject-empty")) {
    return "fill-subject";
  }
  if (issue.id.endsWith("-body-empty")) {
    return "fill-body";
  }
  if (issue.id.endsWith("-recipients-empty")) {
    return "add-recipient";
  }
  if (issue.id.includes("-unsafe-domain") || issue.id.includes("-invalid-format")) {
    return "replace-unsafe-recipient";
  }
  return undefined;
}

/** Create a read-only quick-fix registry from the provided fixes. */
export function createQuickFixRegistry(fixes: QuickFix[] = QUICK_FIXES): QuickFixRegistry {
  const byKind = new Map<QuickFixKind, QuickFix>();
  for (const fix of fixes) {
    byKind.set(fix.kind, fix);
  }

  return {
    list: () => Array.from(byKind.values()),
    get: (kind) => byKind.get(kind),
    resolve: (issue) => {
      const kind = quickFixKindForIssue(issue);
      return kind ? byKind.get(kind) : undefined;
    },
  };
}

/** The default registry built from the common fixes. */
export const defaultQuickFixRegistry: QuickFixRegistry = createQuickFixRegistry();

/**
 * Apply the quick fix that matches `issue` to the matching draft in `drafts`.
 * Returns a new drafts array and whether a fix was applied; never mutates input.
 */
export function applyQuickFix(
  drafts: Draft[],
  issue: ValidationIssue,
  registry: QuickFixRegistry = defaultQuickFixRegistry,
): QuickFixApplication {
  const fix = registry.resolve(issue);
  if (!fix || issue.recordId === undefined) {
    return { applied: false, drafts };
  }

  let applied = false;
  const next = drafts.map((draft) => {
    if (draft.id !== issue.recordId) {
      return draft;
    }
    applied = true;
    return fix.apply(draft, issue);
  });

  return applied ? { applied, drafts: next, fix } : { applied: false, drafts };
}
