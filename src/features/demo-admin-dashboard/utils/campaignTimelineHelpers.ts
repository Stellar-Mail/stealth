import type { ValidationIssue } from "../validation-types";
import type {
  CampaignPhase,
  CampaignTimeline,
  Milestone,
  PreviewWindow,
  ScheduledSend,
} from "../types/campaignTimeline";

/** Parses an ISO local "yyyy-MM-ddTHH:mm" string to a Date. */
function parseLocalDate(iso: string): Date {
  return new Date(iso);
}

// ---------------------------------------------------------------------------
// Phase query helpers
// ---------------------------------------------------------------------------

export function isDateInPhase(date: Date, phase: CampaignPhase): boolean {
  return date >= parseLocalDate(phase.startAt) && date <= parseLocalDate(phase.endAt);
}

export function getPhaseForDate(timeline: CampaignTimeline, date: Date): CampaignPhase | undefined {
  return timeline.phases.find((p) => isDateInPhase(date, p));
}

export function getActivePhase(
  timeline: CampaignTimeline,
  now: Date = new Date(),
): CampaignPhase | undefined {
  return getPhaseForDate(timeline, now);
}

/** Returns the number of whole days between startAt and endAt (inclusive). */
export function getPhaseDurationDays(phase: CampaignPhase): number {
  const start = parseLocalDate(phase.startAt);
  const end = parseLocalDate(phase.endAt);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / msPerDay));
}

export function sortPhasesByStartDate(phases: CampaignPhase[]): CampaignPhase[] {
  return [...phases].sort(
    (a, b) => parseLocalDate(a.startAt).getTime() - parseLocalDate(b.startAt).getTime(),
  );
}

export function getUpcomingMilestones(
  timeline: CampaignTimeline,
  from: Date = new Date(),
): Milestone[] {
  return timeline.milestones.filter((m) => parseLocalDate(m.dueAt) > from);
}

export function getSendsInWindow(
  timeline: CampaignTimeline,
  window: PreviewWindow,
): ScheduledSend[] {
  const idSet = new Set(window.sendIds);
  return timeline.sends.filter((s) => idSet.has(s.id));
}

/** Returns the earliest startAt and latest endAt across all phases, or null for an empty timeline. */
export function getTimelineDateRange(
  timeline: CampaignTimeline,
): { startsAt: string; endsAt: string } | null {
  if (timeline.phases.length === 0) return null;
  const sorted = sortPhasesByStartDate(timeline.phases);
  const latest = [...timeline.phases].sort(
    (a, b) => parseLocalDate(b.endAt).getTime() - parseLocalDate(a.endAt).getTime(),
  );
  return { startsAt: sorted[0].startAt, endsAt: latest[0].endAt };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function issue(
  id: string,
  severity: ValidationIssue["severity"],
  fieldPath: string,
  message: string,
  recordId?: string,
  hint?: string,
): ValidationIssue {
  return {
    id,
    severity,
    fieldPath,
    message,
    datasetId: "campaign-timeline",
    recordId,
    hint,
  };
}

export function validatePhases(phases: CampaignPhase[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const start = parseLocalDate(phase.startAt);
    const end = parseLocalDate(phase.endAt);

    if (start >= end) {
      issues.push(
        issue(
          `phase-date-order-${phase.id}`,
          "error",
          `phases[${i}].endAt`,
          `Phase "${phase.label}" has endAt before or equal to startAt.`,
          phase.id,
          "Set endAt to a date after startAt.",
        ),
      );
    }
  }

  const sorted = sortPhasesByStartDate(phases);
  for (let i = 0; i < sorted.length; i++) {
    const phase = sorted[i];
    const phaseIndex = phases.indexOf(phase);

    if (i > 0) {
      const prev = sorted[i - 1];
      const prevEnd = parseLocalDate(prev.endAt);
      const currStart = parseLocalDate(phase.startAt);

      if (currStart < prevEnd) {
        issues.push(
          issue(
            `phase-overlap-${phase.id}`,
            "error",
            `phases[${phaseIndex}].startAt`,
            `Phase "${phase.label}" overlaps with "${prev.label}".`,
            phase.id,
            "Move startAt to after the previous phase ends.",
          ),
        );
      }
    }
  }

  const orderedIds = sorted.map((p) => p.id);
  const inputIds = phases.map((p) => p.id);
  if (JSON.stringify(orderedIds) !== JSON.stringify(inputIds)) {
    issues.push(
      issue(
        "phases-order-warning",
        "warning",
        "phases",
        "Phases are not in chronological order.",
        undefined,
        "Sort phases by startAt for clearer timeline representation.",
      ),
    );
  }

  return issues;
}

export function validateScheduledSends(
  sends: ScheduledSend[],
  phases: CampaignPhase[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const phaseMap = new Map(phases.map((p) => [p.id, p]));

  for (let i = 0; i < sends.length; i++) {
    const send = sends[i];

    if (send.estimatedCount < 0) {
      issues.push(
        issue(
          `send-count-${send.id}`,
          "error",
          `sends[${i}].estimatedCount`,
          `Send "${send.label}" has a negative estimatedCount.`,
          send.id,
          "Set estimatedCount to 0 or a positive number.",
        ),
      );
    }

    const phase = phaseMap.get(send.phaseId);
    if (!phase) continue;

    const scheduledAt = parseLocalDate(send.scheduledAt);
    if (!isDateInPhase(scheduledAt, phase)) {
      issues.push(
        issue(
          `send-outside-phase-${send.id}`,
          "warning",
          `sends[${i}].scheduledAt`,
          `Send "${send.label}" is scheduled outside its phase window ("${phase.label}").`,
          send.id,
          "Move scheduledAt within the phase's startAt–endAt range.",
        ),
      );
    }
  }

  return issues;
}

export function validateMilestones(milestones: Milestone[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < milestones.length; i++) {
    const ms = milestones[i];
    const due = parseLocalDate(ms.dueAt);

    if (isNaN(due.getTime())) {
      issues.push(
        issue(
          `milestone-invalid-date-${ms.id}`,
          "error",
          `milestones[${i}].dueAt`,
          `Milestone "${ms.label}" has an invalid dueAt value.`,
          ms.id,
          'Use ISO local format "yyyy-MM-ddTHH:mm".',
        ),
      );
      continue;
    }

    if (ms.resolvedAt && ms.status !== "skipped") {
      const resolved = parseLocalDate(ms.resolvedAt);
      if (resolved < due) {
        issues.push(
          issue(
            `milestone-resolved-before-due-${ms.id}`,
            "warning",
            `milestones[${i}].resolvedAt`,
            `Milestone "${ms.label}" was resolved before its due date.`,
            ms.id,
          ),
        );
      }
    }
  }

  return issues;
}

export function validatePreviewWindows(
  windows: PreviewWindow[],
  sends: ScheduledSend[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sendIds = new Set(sends.map((s) => s.id));

  for (let i = 0; i < windows.length; i++) {
    const pw = windows[i];
    const opens = parseLocalDate(pw.opensAt);
    const closes = parseLocalDate(pw.closesAt);

    if (opens >= closes) {
      issues.push(
        issue(
          `preview-window-dates-${pw.id}`,
          "error",
          `previewWindows[${i}].closesAt`,
          `Preview window "${pw.label}" has closesAt before or equal to opensAt.`,
          pw.id,
          "Set closesAt to a time after opensAt.",
        ),
      );
    }

    for (const sendId of pw.sendIds) {
      if (!sendIds.has(sendId)) {
        issues.push(
          issue(
            `preview-window-missing-send-${pw.id}-${sendId}`,
            "warning",
            `previewWindows[${i}].sendIds`,
            `Preview window "${pw.label}" references unknown send "${sendId}".`,
            pw.id,
            "Remove the sendId or add the corresponding ScheduledSend.",
          ),
        );
      }
    }
  }

  return issues;
}

export function validateCampaignTimeline(timeline: CampaignTimeline): ValidationIssue[] {
  return [
    ...validatePhases(timeline.phases),
    ...validateScheduledSends(timeline.sends, timeline.phases),
    ...validateMilestones(timeline.milestones),
    ...validatePreviewWindows(timeline.previewWindows, timeline.sends),
  ];
}
