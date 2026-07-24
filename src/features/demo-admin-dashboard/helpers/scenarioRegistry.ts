import type { Draft } from "../types/draft";
import type { DemoScenario, ScenarioLoadMode, ScenarioRegistry } from "../types/scenario";

/**
 * Built-in demo scenarios. All data is fake, deterministic, and safe for
 * public repository review (addresses use example.com / *.stealth.demo).
 */
export const demoScenarios: DemoScenario[] = [
  {
    id: "scenario-welcome",
    name: "Welcome announcement",
    description: "A short welcome message for the demo community list.",
    draft: {
      id: "draft-scenario-welcome",
      subject: "Welcome to the Stellar Mail demo",
      body: "Thanks for trying the demo. Explore the dashboard to populate sample data.",
      recipients: ["community@example.com"],
    },
  },
  {
    id: "scenario-protocol-update",
    name: "Protocol update notice",
    description: "Notifies demo recipients about an upcoming protocol change.",
    draft: {
      id: "draft-scenario-protocol-update",
      subject: "Upcoming protocol update",
      body: "A demo protocol upgrade is scheduled. No action is required for this sample.",
      recipients: ["ops@example.org", "updates@stealth.demo"],
    },
  },
];

/**
 * Creates a read-only scenario registry from the provided scenarios.
 * Later entries with a duplicate id override earlier ones, keeping the
 * registry deterministic.
 */
export function createScenarioRegistry(
  scenarios: DemoScenario[] = demoScenarios,
): ScenarioRegistry {
  const byId = new Map<string, DemoScenario>();
  for (const scenario of scenarios) {
    byId.set(scenario.id, scenario);
  }

  return {
    list: () => Array.from(byId.values()),
    get: (id: string) => byId.get(id),
    has: (id: string) => byId.has(id),
  };
}

/**
 * Loads a scenario's draft into the current draft state.
 *
 * - "replace" returns a copy of the scenario draft, ignoring the current draft.
 * - "merge" keeps the current draft id and overlays the scenario's non-empty
 *   fields, unioning recipients without duplicates.
 */
export function loadScenarioIntoDraft(
  current: Draft | null,
  scenario: DemoScenario,
  mode: ScenarioLoadMode = "replace",
): Draft {
  if (mode === "replace" || current === null) {
    return {
      id: scenario.draft.id,
      subject: scenario.draft.subject,
      body: scenario.draft.body,
      recipients: [...scenario.draft.recipients],
    };
  }

  const mergedRecipients = [...current.recipients];
  for (const recipient of scenario.draft.recipients) {
    if (!mergedRecipients.includes(recipient)) {
      mergedRecipients.push(recipient);
    }
  }

  return {
    id: current.id,
    subject: scenario.draft.subject || current.subject,
    body: scenario.draft.body || current.body,
    recipients: mergedRecipients,
  };
}
