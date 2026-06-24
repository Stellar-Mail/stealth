/**
 * Types for the demo-admin label manager.
 *
 * Labels are lightweight, deterministic tags that maintainers can create,
 * apply, and clean up across demo messages. They never reference real mail.
 */

/** A single label that can be applied to demo messages. */
export interface DemoLabel {
  /** Stable identifier derived from the normalized label name. */
  id: string;
  /** Human-readable label name as entered by the maintainer. */
  name: string;
  /** Optional accent color token used by the UI. */
  color?: string;
}

/** A demo message that carries zero or more label ids. */
export interface LabeledDemoMessage {
  id: string;
  subject: string;
  from: string;
  email: string;
  labelIds: string[];
}

/** A label paired with how many demo messages currently use it. */
export interface LabelUsage {
  label: DemoLabel;
  count: number;
}
