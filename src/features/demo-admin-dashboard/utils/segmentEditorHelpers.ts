import type { AudienceSegment } from "../types/audienceSegment";
import type {
  EditableSegment,
  SegmentEditorState,
  SegmentFieldError,
  SegmentValidationResult,
} from "../types/segmentEditorState";

export function initEditorState(base: AudienceSegment[]): SegmentEditorState {
  return {
    segments: base.map((s) => ({ ...s, personaIds: [] })),
  };
}

export function updateSegmentLabel(segment: EditableSegment, label: string): EditableSegment {
  return { ...segment, label };
}

export function updateSegmentDescription(
  segment: EditableSegment,
  description: string,
): EditableSegment {
  return { ...segment, description };
}

export function addCriteria(segment: EditableSegment, criterion: string): EditableSegment {
  const trimmed = criterion.trim();
  if (!trimmed) return segment;
  return { ...segment, criteria: [...segment.criteria, trimmed] };
}

export function removeCriteria(segment: EditableSegment, index: number): EditableSegment {
  return {
    ...segment,
    criteria: segment.criteria.filter((_, i) => i !== index),
  };
}

export function validateSegment(segment: EditableSegment): SegmentValidationResult {
  const errors: SegmentFieldError[] = [];

  if (segment.label.trim() === "") {
    errors.push({ field: "label", severity: "error", message: "Label is required" });
  } else if (segment.label.length > 50) {
    errors.push({
      field: "label",
      severity: "error",
      message: "Label must be 50 characters or fewer",
    });
  }

  if (segment.criteria.length === 0) {
    errors.push({
      field: "criteria",
      severity: "warning",
      message: "No filter criteria — all senders will match this segment",
    });
  }

  if (segment.personaIds.length === 0) {
    errors.push({
      field: "personas",
      severity: "info",
      message: "No personas assigned to this segment",
    });
  }

  return {
    valid: !errors.some((e) => e.severity === "error"),
    errors,
  };
}
