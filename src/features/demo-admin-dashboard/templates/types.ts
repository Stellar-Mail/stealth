/**
 * Message template types for the Demo Admin Dashboard.
 *
 * Templates are pre-written demo messages an admin can pick and insert into the
 * draft dataset that populates the demo inbox. All data is fake, deterministic,
 * and safe for public repository review.
 */

export type TemplateCategory =
  "welcome" | "transactional" | "security" | "event" | "newsletter" | "internal";

export interface MessageTemplate {
  /** Stable, unique identifier. */
  id: string;
  /** Short human-readable name shown in the picker list. */
  name: string;
  category: TemplateCategory;
  /** One-line summary of what the template demonstrates. */
  description: string;
  /** Draft subject line. */
  subject: string;
  /** Draft body. May contain newlines. */
  body: string;
  /** Fake demo recipients. */
  recipients: string[];
  /** Search keywords beyond the name/subject. */
  tags: string[];
}

export const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = {
  welcome: "Welcome",
  transactional: "Transactional",
  security: "Security",
  event: "Event",
  newsletter: "Newsletter",
  internal: "Internal",
};
