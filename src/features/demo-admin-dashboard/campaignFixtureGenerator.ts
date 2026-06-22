export interface CampaignScenario {
  id: string;
  name: string;
  tags: string[];
}

export interface CampaignPersona {
  id: string;
  name: string;
  email: string;
}

export interface CampaignMessageTemplate {
  id: string;
  subject: string;
  body: string;
}

export type CampaignFixtureStatus = "draft" | "scheduled" | "sent";

export interface CampaignFixture {
  id: string;
  name: string;
  scenarioId: string;
  personaId: string;
  templateId: string;
  subject: string;
  body: string;
  recipientEmail: string;
  tags: string[];
  status: CampaignFixtureStatus;
  createdAt: string;
}

export interface GenerateCampaignFixturesOptions {
  seed: number | string;
  count?: number;
  scenarios?: CampaignScenario[];
  personas?: CampaignPersona[];
  templates?: CampaignMessageTemplate[];
  startDate?: string;
}

export const DEFAULT_CAMPAIGN_SCENARIOS: CampaignScenario[] = [
  { id: "onboarding", name: "Onboarding Welcome", tags: ["lifecycle", "welcome"] },
  { id: "reengagement", name: "Re-engagement Nudge", tags: ["lifecycle", "winback"] },
  { id: "newsletter", name: "Monthly Newsletter", tags: ["newsletter", "update"] },
  { id: "product-launch", name: "Product Launch", tags: ["announcement", "launch"] },
];

export const DEFAULT_CAMPAIGN_PERSONAS: CampaignPersona[] = [
  { id: "persona-founder", name: "Avery Founder", email: "avery@example.com" },
  { id: "persona-marketer", name: "Morgan Marketer", email: "morgan@example.com" },
  { id: "persona-support", name: "Sasha Support", email: "sasha@example.com" },
];

export const DEFAULT_CAMPAIGN_TEMPLATES: CampaignMessageTemplate[] = [
  {
    id: "template-intro",
    subject: "Welcome aboard, {name}",
    body: "Hi {name}, thanks for joining the {scenario} program.",
  },
  {
    id: "template-update",
    subject: "Your {scenario} update",
    body: "Hi {name}, here is the latest on {scenario}.",
  },
  {
    id: "template-cta",
    subject: "A quick next step for {scenario}",
    body: "Hi {name}, take the next step with {scenario} today.",
  },
];

const STATUSES: CampaignFixtureStatus[] = ["draft", "scheduled", "sent"];
const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Converts a numeric or string seed into a 32-bit unsigned integer so the
 * generator produces the same output for the same seed.
 */
function hashSeed(seed: number | string): number {
  if (typeof seed === "number") {
    return seed >>> 0;
  }
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic mulberry32 pseudo-random number generator. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key]);
}

/**
 * Generates deterministic, fake campaign fixtures from scenarios, personas,
 * message templates, and a seed. The same options always produce the same
 * fixtures, which keeps demo data stable and safe for public review.
 */
export function generateCampaignFixtures(
  options: GenerateCampaignFixturesOptions,
): CampaignFixture[] {
  const {
    seed,
    count = 5,
    scenarios = DEFAULT_CAMPAIGN_SCENARIOS,
    personas = DEFAULT_CAMPAIGN_PERSONAS,
    templates = DEFAULT_CAMPAIGN_TEMPLATES,
    startDate = "2026-01-01T09:00:00.000Z",
  } = options;

  if (count < 0) {
    throw new Error("count must be zero or greater");
  }
  if (scenarios.length === 0 || personas.length === 0 || templates.length === 0) {
    throw new Error("scenarios, personas, and templates must not be empty");
  }

  const rng = createRng(hashSeed(seed));
  const start = new Date(startDate).getTime();
  const fixtures: CampaignFixture[] = [];

  for (let index = 0; index < count; index += 1) {
    const scenario = pick(rng, scenarios);
    const persona = pick(rng, personas);
    const template = pick(rng, templates);
    const status = pick(rng, STATUSES);
    const values: Record<string, string> = {
      name: persona.name,
      scenario: scenario.name,
    };

    fixtures.push({
      id: `campaign-${scenario.id}-${index + 1}`,
      name: `${scenario.name} #${index + 1}`,
      scenarioId: scenario.id,
      personaId: persona.id,
      templateId: template.id,
      subject: renderTemplate(template.subject, values),
      body: renderTemplate(template.body, values),
      recipientEmail: persona.email,
      tags: [...scenario.tags],
      status,
      createdAt: new Date(start + index * DAY_IN_MS).toISOString(),
    });
  }

  return fixtures;
}
