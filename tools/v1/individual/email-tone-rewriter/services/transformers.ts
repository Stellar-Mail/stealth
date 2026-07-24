/**
 * Tone-specific transformer implementations.
 *
 * Each function is pure, deterministic, and safe for public review.
 */

export type ToneId = "concise" | "friendly" | "formal" | "apologetic";

type ReplacementRule = [RegExp, string];

const CONTRACTIONS: ReplacementRule[] = [
  [/\bdon't\b/gi, "do not"],
  [/\bdoesn't\b/gi, "does not"],
  [/\bdidn't\b/gi, "did not"],
  [/\bcan't\b/gi, "cannot"],
  [/\bwon't\b/gi, "will not"],
  [/\bI'm\b/gi, "I am"],
  [/\bit's\b/gi, "it is"],
  [/\bwe're\b/gi, "we are"],
  [/\byou're\b/gi, "you are"],
  [/\bI'll\b/gi, "I will"],
  [/\bwe'll\b/gi, "we will"],
  [/\bI've\b/gi, "I have"],
  [/\bwe've\b/gi, "we have"],
];

const CASUAL_GREETINGS: ReplacementRule[] = [
  [/\bhey\b/gi, "Hello"],
  [/\bhi\b/gi, "Hello"],
  [/\byeah\b/gi, "yes"],
  [/\bthanks\b/gi, "thank you"],
  [/\bthx\b/gi, "thank you"],
];

const FORMAL_PHRASES: ReplacementRule[] = [
  [/\bcan you\b/gi, "could you please"],
  [/\bwanna\b/gi, "would like to"],
  [/\bgonna\b/gi, "going to"],
  [/\bgimme\b/gi, "please provide"],
  [/\blet me know\b/gi, "please inform me"],
  [/\basap\b/gi, "as soon as possible"],
];

const FRIENDLY_REPLACEMENTS: ReplacementRule[] = [
  [/\bhey\b/gi, "Hi"],
  [/\bis late\b/gi, "is running a little behind"],
  [/\bregards\b/gi, "thanks so much"],
  [/\bdeadline\b/gi, "target date"],
];

const FILLERS: RegExp[] = [
  /\bjust\b/gi,
  /\breally\b/gi,
  /\bbasically\b/gi,
  /\bactually\b/gi,
  /\bvery\b/gi,
  /\bsimply\b/gi,
  /\bobviously\b/gi,
];

function applyReplacements(text: string, rules: ReplacementRule[]): string {
  return rules.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

function removeFillers(text: string): string {
  return FILLERS.reduce((acc, pattern) => acc.replace(pattern, ""), text);
}

export function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

export function capitalizeSentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => sentence.charAt(0).toUpperCase() + sentence.slice(1))
    .join(" ");
}

export function toConcise(body: string): string {
  return capitalizeSentences(tidy(removeFillers(body)));
}

export function toFriendly(body: string): string {
  return capitalizeSentences(tidy(applyReplacements(body, FRIENDLY_REPLACEMENTS)));
}

export function toFormal(body: string): string {
  let text = applyReplacements(body, CONTRACTIONS);
  text = applyReplacements(text, CASUAL_GREETINGS);
  text = applyReplacements(text, FORMAL_PHRASES);
  return capitalizeSentences(tidy(text));
}

export function toApologetic(body: string): string {
  const text = applyReplacements(body, CONTRACTIONS);
  return tidy("I apologize for any inconvenience. " + text);
}

export const TONE_TRANSFORMS: Record<ToneId, (body: string) => string> = {
  concise: toConcise,
  friendly: toFriendly,
  formal: toFormal,
  apologetic: toApologetic,
};
