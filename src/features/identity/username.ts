import { z } from "zod";

/**
 * Canonical Stealth username rules (Issue #1910 / BETA-003).
 *
 * A username is reserved once, as its *canonical* form, and every lookup,
 * availability check, and reservation attempt goes through the same
 * normalization pipeline. This is what guarantees "alice", "Alice", "ALICE",
 * and confusable look-alikes (e.g. Cyrillic homoglyphs of "alice") all
 * resolve to a single identity instead of letting case or Unicode variation
 * mint free aliases.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/** Hard cap on raw (pre-normalization) input, so pathological input never reaches the regex/Unicode passes below. */
export const RAW_USERNAME_MAX_LENGTH = 128;

/**
 * Canonical usernames are lowercase ASCII letters, digits, hyphens, and
 * underscores, and must start and end with a letter or digit (no leading or
 * trailing separator).
 */
export const USERNAME_FORMAT_REGEX = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;

/**
 * Invisible/zero-width code points that carry no visual signal but can be
 * used to smuggle a distinct byte sequence past a naive equality check (e.g.
 * "ad" + ZERO WIDTH SPACE + "min" rendering identically to "admin").
 * Stripped outright rather than folded, since they have no legitimate use in
 * a handle: U+00AD (soft hyphen), U+200B-U+200D (zero-width
 * space/ZWNJ/ZWJ), U+2060 (word joiner), U+FEFF (BOM / zero-width no-break
 * space).
 */
const INVISIBLE_CHARACTERS = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Curated table of common single-character homoglyphs (Unicode TR39-style
 * "confusables") that are visually indistinguishable from a Latin letter in
 * most UI fonts but are technically distinct code points — most notably the
 * Cyrillic and Greek letters used in real-world username-squatting and
 * phishing attacks. This is intentionally a small, high-confidence allowlist
 * (keyed by numeric code point, not literal glyphs, so every mapping is
 * auditable and immune to transcription/rendering ambiguity) rather than a
 * full confusables-skeleton implementation — no such library is a project
 * dependency. Every character not recognized here is rejected outright by
 * the ASCII charset check below, so the failure mode is always "reject
 * unknown Unicode", never "silently allow a lookalike alias".
 *
 * Compatibility variants (fullwidth Latin, fullwidth digits, ligatures,
 * etc.) are already folded by the NFKC normalization step and need no entry
 * here.
 */
const CYRILLIC_TO_LATIN: Readonly<Record<number, string>> = Object.freeze({
  0x0430: "a", // CYRILLIC SMALL LETTER A
  0x0435: "e", // CYRILLIC SMALL LETTER IE
  0x043e: "o", // CYRILLIC SMALL LETTER O
  0x0440: "p", // CYRILLIC SMALL LETTER ER
  0x0441: "c", // CYRILLIC SMALL LETTER ES
  0x0445: "x", // CYRILLIC SMALL LETTER HA
  0x0443: "y", // CYRILLIC SMALL LETTER U
  0x0456: "i", // CYRILLIC SMALL LETTER BYELORUSSIAN-UKRAINIAN I
  0x0455: "s", // CYRILLIC SMALL LETTER DZE
  0x0458: "j", // CYRILLIC SMALL LETTER JE
  0x0410: "a", // CYRILLIC CAPITAL LETTER A
  0x0412: "b", // CYRILLIC CAPITAL LETTER VE
  0x0415: "e", // CYRILLIC CAPITAL LETTER IE
  0x041a: "k", // CYRILLIC CAPITAL LETTER KA
  0x041c: "m", // CYRILLIC CAPITAL LETTER EM
  0x041d: "h", // CYRILLIC CAPITAL LETTER EN
  0x041e: "o", // CYRILLIC CAPITAL LETTER O
  0x0420: "p", // CYRILLIC CAPITAL LETTER ER
  0x0421: "c", // CYRILLIC CAPITAL LETTER ES
  0x0422: "t", // CYRILLIC CAPITAL LETTER TE
  0x0425: "x", // CYRILLIC CAPITAL LETTER HA
  0x0405: "s", // CYRILLIC CAPITAL LETTER DZE
  0x0408: "j", // CYRILLIC CAPITAL LETTER JE
});

const GREEK_TO_LATIN: Readonly<Record<number, string>> = Object.freeze({
  0x03b1: "a", // GREEK SMALL LETTER ALPHA
  0x03b2: "b", // GREEK SMALL LETTER BETA
  0x03bf: "o", // GREEK SMALL LETTER OMICRON
  0x03bd: "v", // GREEK SMALL LETTER NU
  0x03c1: "p", // GREEK SMALL LETTER RHO
  0x03c4: "t", // GREEK SMALL LETTER TAU
  0x03c5: "u", // GREEK SMALL LETTER UPSILON
  0x03b9: "i", // GREEK SMALL LETTER IOTA
  0x03ba: "k", // GREEK SMALL LETTER KAPPA
  0x03c7: "x", // GREEK SMALL LETTER CHI
  0x0391: "a", // GREEK CAPITAL LETTER ALPHA
  0x0392: "b", // GREEK CAPITAL LETTER BETA
  0x0395: "e", // GREEK CAPITAL LETTER EPSILON
  0x0396: "z", // GREEK CAPITAL LETTER ZETA
  0x0397: "h", // GREEK CAPITAL LETTER ETA
  0x0399: "i", // GREEK CAPITAL LETTER IOTA
  0x039a: "k", // GREEK CAPITAL LETTER KAPPA
  0x039c: "m", // GREEK CAPITAL LETTER MU
  0x039d: "n", // GREEK CAPITAL LETTER NU
  0x039f: "o", // GREEK CAPITAL LETTER OMICRON
  0x03a1: "p", // GREEK CAPITAL LETTER RHO
  0x03a4: "t", // GREEK CAPITAL LETTER TAU
  0x03a5: "y", // GREEK CAPITAL LETTER UPSILON
  0x03a7: "x", // GREEK CAPITAL LETTER CHI
});

const CONFUSABLE_FOLD_MAP: ReadonlyMap<string, string> = new Map(
  [...Object.entries(CYRILLIC_TO_LATIN), ...Object.entries(GREEK_TO_LATIN)].map(
    ([codePoint, latin]) => [String.fromCodePoint(Number(codePoint)), latin],
  ),
);

function stripInvisibleCharacters(input: string): string {
  return input.replace(INVISIBLE_CHARACTERS, "");
}

function foldConfusables(input: string): string {
  return Array.from(input)
    .map((char) => CONFUSABLE_FOLD_MAP.get(char) ?? char)
    .join("");
}

/**
 * The full normalization pipeline: Unicode compatibility decomposition
 * (folds fullwidth/compatibility variants to their canonical ASCII form),
 * invisible-character stripping, confusable folding, then case folding.
 *
 * This function is deliberately pure and side-effect free so it can run
 * identically on the client (live availability feedback) and the server
 * (authoritative validation before reservation).
 */
export function normalizeUsername(raw: string): string {
  const nfkc = raw.normalize("NFKC");
  const withoutInvisibles = stripInvisibleCharacters(nfkc);
  const folded = foldConfusables(withoutInvisibles);
  return folded.toLowerCase().trim();
}

export function isReservedUsername(canonical: string): boolean {
  return RESERVED_USERNAMES.has(canonical);
}

/**
 * Usernames that are never reservable regardless of who asks, because they
 * are operationally or brand-sensitive (service mailboxes, protocol nouns,
 * generic placeholders). Matched against the fully canonicalized value, so
 * confusable/case variants of a reserved word are rejected too.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "root",
  "sysadmin",
  "moderator",
  "mod",
  "staff",
  "official",
  "support",
  "help",
  "helpdesk",
  "system",
  "stealth",
  "stealthmail",
  "postmaster",
  "webmaster",
  "hostmaster",
  "mailer-daemon",
  "abuse",
  "security",
  "billing",
  "sales",
  "contact",
  "info",
  "noreply",
  "no-reply",
  "api",
  "www",
  "mail",
  "smtp",
  "imap",
  "pop3",
  "ftp",
  "test",
  "null",
  "undefined",
  "nobody",
  "everyone",
  "anonymous",
  "guest",
  "public",
  "private",
  "here",
  "channel",
]);

/**
 * Validates and canonicalizes a candidate username in one pass.
 *
 * The raw string is normalized first, so length/format/reserved-word rules
 * are always evaluated against the canonical form a client would actually
 * end up reserving — never the raw, potentially-aliasing input.
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(1, "Username must not be empty")
  .max(
    RAW_USERNAME_MAX_LENGTH,
    `Username input must be at most ${RAW_USERNAME_MAX_LENGTH} characters`,
  )
  .transform((raw) => normalizeUsername(raw))
  .pipe(
    z
      .string()
      .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters`)
      .max(USERNAME_MAX_LENGTH, `Username must be at most ${USERNAME_MAX_LENGTH} characters`)
      .regex(
        USERNAME_FORMAT_REGEX,
        "Username may only contain lowercase letters, numbers, hyphens, and underscores, and must start and end with a letter or number",
      ),
  )
  .superRefine((value, ctx) => {
    if (isReservedUsername(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${value}" is a reserved username and cannot be registered`,
      });
    }
  });

export type CanonicalUsername = z.infer<typeof usernameSchema>;

export interface UsernameValidationIssue {
  path: string;
  message: string;
}

export type UsernameValidationResult =
  | { valid: true; canonical: CanonicalUsername }
  | { valid: false; issues: UsernameValidationIssue[] };

/** Non-throwing variant of {@link usernameSchema}, convenient for UI-side live validation. */
export function validateUsernameCandidate(raw: string): UsernameValidationResult {
  const result = usernameSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, canonical: result.data };
  }
  return {
    valid: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "$",
      message: issue.message,
    })),
  };
}
