/**
 * Message template types for the Demo Admin Dashboard.
 *
 * Templates are pre-written demo messages an admin can pick and insert into the
 * draft dataset that populates the demo inbox. All data is fake, deterministic,
 * and safe for public repository review.
 */

export type TemplateCategory =
  | "welcome"
  | "transactional"
  | "security"
  | "event"
  | "newsletter"
  | "internal";

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

/**
 * Metadata describing a demo scenario that groups one or more templates.
 *
 * Scenarios keep the template library easy to browse and let fixtures reuse the
 * same deterministic template set in different review contexts.
 */
export interface TemplateScenario {
  /** Stable, unique identifier. */
  id: string;
  /** Human-readable scenario name. */
  name: string;
  /** Short explanation of what the scenario demonstrates. */
  description: string;
  /** Category used to group the scenario in documentation and previews. */
  category: TemplateCategory;
  /** Template ids that belong to the scenario. */
  templateIds: string[];
  /** Scenario-level search tags. */
  tags: string[];
}

/**
 * Deterministic demo fixture derived from a template/scenario pair.
 *
 * These fixtures are used in tests and documentation to show how a reusable
 * template can be traced back to the scenario that produced it.
 */
export interface TemplateDemoFixture {
  id: string;
  scenarioId: string;
  scenarioName: string;
  templateId: string;
  templateName: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  recipients: string[];
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
