/**
 * Detect an OTP, passkey, or verification code in an email body.
 * Returns the digits string (4-8) or null.
 * Tightened for security-sensitive mail contexts (common verification formats).
 */
export function detectOtp(body: string): string | null {
  if (!body) return null;

  // Primary: keyword + digit sequence (4-8 digits, allowing spaces/dashes)
  const keyword =
    /(?:otp|one[-\s]?time(?:\s+password)?|passkey|pass\s?code|verification(?:\s+code)?|security\s+code|code|pin)\b[^\d]{0,50}((?:\d[\s-]?){4,8})/i;
  const match = body.match(keyword);

  if (match) {
    const digits = match[1].replace(/\D/g, "");
    if (digits.length >= 4 && digits.length <= 8) return digits;
  }

  // Secondary: explicit 6-digit standalone (common in verification mail)
  const standalone6 = body.match(/(?:^|\n|\s)(\d{6})(?:\s|\n|$)/);
  if (standalone6) return standalone6[1];

  // Tertiary: 4 or 8 digit codes in security mail
  const explicit = body.match(/(?:^|\n|\s)(\d{4}|\d{8})(?:\s|\n|$)/);
  if (explicit) return explicit[1];

  return null;
}
