import type { AudienceSegment } from "./audienceSegment";

export interface EditableSegment extends AudienceSegment {
  personaIds: string[];
}

export interface SegmentEditorState {
  segments: EditableSegment[];
}

export interface SegmentFieldError {
  field: "label" | "description" | "criteria" | "personas";
  message: string;
  severity: "error" | "warning" | "info";
}

export interface SegmentValidationResult {
  /** true only when errors array has no "error"-severity entries */
  valid: boolean;
  errors: SegmentFieldError[];
}
