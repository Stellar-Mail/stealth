/**
 * Email Tone Rewriter — tone preset definitions and utilities.
 *
 * Presets bundle a tone with configuration options like maxWords, preferred
 * openers, and behavior flags. Users can select a preset instead of manually
 * configuring each rewrite. Pure service: no state, no side effects.
 */

import type { ToneId } from "./emailToneRewriter";

export interface PresetDefinition {
  /** Unique identifier for this preset. */
  id: string;
  /** Human-readable label for UI display. */
  label: string;
  /** Short description of when to use this preset. */
  description: string;
  /** The tone to apply. */
  tone: ToneId;
  /** Optional word cap for the rewrite. */
  maxWords?: number;
  /** Whether this preset prefers a shorter rewrite. */
  preferShort: boolean;
  /** Whether this preset adds an apology prefix. */
  includesApology: boolean;
  /** Suggested opener override, if any. */
  suggestedOpener?: string;
  /** Suggested closer override, if any. */
  suggestedCloser?: string;
  /** Tags for filtering and categorization. */
  tags: string[];
}

export interface PresetGroup {
  /** Group label for UI section headers. */
  label: string;
  /** Presets in this group. */
  presets: PresetDefinition[];
}

/** Built-in presets that ship with the tool. */
export const BUILT_IN_PRESETS: PresetDefinition[] = [
  {
    id: "concise-quick",
    label: "Quick & Concise",
    description: "Short, direct, and to the point. Best for busy recipients.",
    tone: "concise",
    maxWords: 50,
    preferShort: true,
    includesApology: false,
    suggestedOpener: "Hi,",
    suggestedCloser: "Thanks.",
    tags: ["short", "direct", "business"],
  },
  {
    id: "concise-standard",
    label: "Concise",
    description: "Removes filler words while preserving all key points.",
    tone: "concise",
    preferShort: true,
    includesApology: false,
    tags: ["short", "business"],
  },
  {
    id: "friendly-warm",
    label: "Warm & Friendly",
    description: "A warm, approachable tone for colleagues and partners.",
    tone: "friendly",
    preferShort: false,
    includesApology: false,
    suggestedOpener: "Hi there,",
    suggestedCloser: "Thanks so much!",
    tags: ["warm", "casual", "team"],
  },
  {
    id: "friendly-light",
    label: "Light & Casual",
    description: "Very casual tone for close team members.",
    tone: "friendly",
    preferShort: false,
    includesApology: false,
    suggestedOpener: "Hey,",
    suggestedCloser: "Cheers!",
    tags: ["casual", "team", "informal"],
  },
  {
    id: "formal-business",
    label: "Formal Business",
    description: "Professional language for clients and stakeholders.",
    tone: "formal",
    preferShort: false,
    includesApology: false,
    suggestedOpener: "Hello,",
    suggestedCloser: "Thank you for your time.",
    tags: ["professional", "client", "business"],
  },
  {
    id: "formal-executive",
    label: "Executive Summary",
    description: "Very formal, expanded language for executive communication.",
    tone: "formal",
    maxWords: 30,
    preferShort: true,
    includesApology: false,
    suggestedOpener: "Dear",
    suggestedCloser: "Respectfully,",
    tags: ["executive", "formal", "brief"],
  },
  {
    id: "formal-legal",
    label: "Legal / Compliance",
    description: "Precise, cautious language for legal or compliance contexts.",
    tone: "formal",
    preferShort: false,
    includesApology: false,
    suggestedOpener: "To Whom It May Concern,",
    suggestedCloser: "Please advise accordingly.",
    tags: ["legal", "compliance", "formal"],
  },
  {
    id: "apologetic-standard",
    label: "Apologetic",
    description: "Adds an apology prefix and softens the language.",
    tone: "apologetic",
    preferShort: false,
    includesApology: true,
    suggestedOpener: "Hi, and thank you for your patience.",
    suggestedCloser: "Sorry again for the inconvenience.",
    tags: ["apology", "soft", "polite"],
  },
  {
    id: "apologetic-brief",
    label: "Brief Apology",
    description: "A short, sincere apology without over-explaining.",
    tone: "apologetic",
    maxWords: 40,
    preferShort: true,
    includesApology: true,
    suggestedOpener: "Hi,",
    suggestedCloser: "Thank you for understanding.",
    tags: ["apology", "short", "polite"],
  },
  {
    id: "apologetic-formal",
    label: "Formal Apology",
    description: "A formal, structured apology for official correspondence.",
    tone: "apologetic",
    preferShort: false,
    includesApology: true,
    suggestedOpener: "Dear",
    suggestedCloser: "We sincerely apologize for any inconvenience caused.",
    tags: ["apology", "formal", "official"],
  },
];

/**
 * Returns all presets grouped by tone for UI display.
 */
export function getPresetsGrouped(): PresetGroup[] {
  const groups: Record<string, PresetDefinition[]> = {};

  for (const preset of BUILT_IN_PRESETS) {
    const tone = preset.tone;
    if (!groups[tone]) {
      groups[tone] = [];
    }
    groups[tone].push(preset);
  }

  return Object.entries(groups).map(([tone, presets]) => ({
    label: tone.charAt(0).toUpperCase() + tone.slice(1),
    presets,
  }));
}

/**
 * Finds a preset by its id.
 */
export function findPreset(id: string): PresetDefinition | undefined {
  return BUILT_IN_PRESETS.find((p) => p.id === id);
}

/**
 * Returns presets that match a given tag.
 */
export function filterByTag(tag: string): PresetDefinition[] {
  return BUILT_IN_PRESETS.filter((p) => p.tags.includes(tag));
}

/**
 * Returns the best matching preset for a given tone and optional maxWords.
 */
export function bestPreset(tone: ToneId, maxWords?: number): PresetDefinition {
  const candidates = BUILT_IN_PRESETS.filter((p) => p.tone === tone);
  if (candidates.length === 0) {
    return BUILT_IN_PRESETS[0];
  }
  if (maxWords !== undefined) {
    const exact = candidates.find(
      (c) => c.maxWords !== undefined && Math.abs(c.maxWords - maxWords) <= 10,
    );
    if (exact) return exact;
  }
  return candidates[0];
}

/**
 * Returns all unique tags across all presets.
 */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const preset of BUILT_IN_PRESETS) {
    for (const tag of preset.tags) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}

/**
 * Returns a short summary of a preset for tooltip or aria-label use.
 */
export function describePreset(preset: PresetDefinition): string {
  const parts: string[] = [preset.label];
  if (preset.maxWords) {
    parts.push(`(max ${preset.maxWords} words)`);
  }
  parts.push(`- ${preset.description}`);
  return parts.join(" ");
}

/**
 * Validates that a preset id exists and returns it, or returns a default.
 */
export function resolvePreset(
  presetId: string | undefined,
  fallbackTone: ToneId = "friendly",
): PresetDefinition {
  if (!presetId) {
    return bestPreset(fallbackTone);
  }
  const preset = findPreset(presetId);
  if (preset) return preset;
  return bestPreset(fallbackTone);
}

/**
 * Creates a configuration object from a preset that can be applied to a draft.
 */
export function presetToConfig(preset: PresetDefinition): {
  tone: ToneId;
  maxWords?: number;
} {
  return {
    tone: preset.tone,
    maxWords: preset.maxWords,
  };
}

/**
 * Returns presets that are appropriate for a given context tag.
 * For example, "apology" returns all apology-related presets.
 */
export function presetsForContext(context: string): PresetDefinition[] {
  const contextLower = context.toLowerCase();
  return BUILT_IN_PRESETS.filter(
    (p) =>
      p.tags.includes(contextLower) ||
      p.label.toLowerCase().includes(contextLower) ||
      p.description.toLowerCase().includes(contextLower),
  );
}

/**
 * Returns the number of presets available for each tone.
 */
export function presetCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const preset of BUILT_IN_PRESETS) {
    counts[preset.tone] = (counts[preset.tone] || 0) + 1;
  }
  return counts;
}

/**
 * Suggests a preset based on the length and content of a draft body.
 * Longer, more formal content suggests formal presets.
 * Short, direct content suggests concise presets.
 * Content with apology keywords suggests apologetic presets.
 */
export function suggestPreset(bodyText: string): PresetDefinition {
  const words = bodyText.split(/\s+/).filter(Boolean).length;
  const lower = bodyText.toLowerCase();

  const apologyWords = ["sorry", "apologize", "apology", "regret", "unfortunately"];
  const hasApology = apologyWords.some((w) => lower.includes(w));

  if (hasApology) {
    return words < 40 ? findPreset("apologetic-brief")! : findPreset("apologetic-standard")!;
  }

  if (words < 20) {
    return findPreset("concise-quick")!;
  }

  if (words > 100) {
    return findPreset("formal-business")!;
  }

  return findPreset("friendly-warm")!;
}
