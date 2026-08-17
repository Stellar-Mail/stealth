export const MAX_RULES = 500;
export const MAX_CONDITION_GROUPS = 20;
export const MAX_CONDITIONS_PER_GROUP = 50;
export const MAX_PATTERN_LENGTH = 256;
export const MAX_MAIL_SUBJECT_LENGTH = 512;
export const MAX_MAIL_BODY_LENGTH = 1_000_000;

export function sanitizeText(value: string): string {
  return value.trim();
}

export function isSafeRegexPattern(pattern: string): boolean {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return false;
  }

  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
