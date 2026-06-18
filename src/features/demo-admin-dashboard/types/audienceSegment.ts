export type AudienceSegmentId =
  | "investors"
  | "founders"
  | "events"
  | "relay-operators"
  | "unknown-senders";

export interface AudienceSegment {
  id: AudienceSegmentId;
  label: string;
  description: string;
  icon: string;
  estimatedSize: number;
  criteria: string[];
}
