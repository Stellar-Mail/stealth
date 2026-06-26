/**
 * Detect an OTP, passkey, or verification code in an email body.
 * Returns the digits string (4-8) or null.
 */
const KEYWORD_OTP_PATTERN =
  /(?:otp|one[-\s]?time(?:\s+password)?|passkey|pass\s?code|verification(?:\s+code)?|security\s+code|code|pin)\b[^\d]{0,40}((?:\d[\s-]?){4,8})/i;
const STANDALONE_SIX_DIGIT_PATTERN = /(?:^|\n)\s*(\d{6})\s*(?:\n|$)/;
const SECURITY_KEYWORD_PATTERN =
  /otp|one[-\s]?time|passkey|pass\s?code|verification|security\s+code|code|pin/i;

const MAX_SECURITY_CODE_SCAN_LENGTH = 4000;

export function detectOtp(body: string): string | null {
  if (!body) return null;

  const firstSecurityKeyword = body.search(SECURITY_KEYWORD_PATTERN);
  const scanBody =
    firstSecurityKeyword === -1
      ? body
      : body.slice(firstSecurityKeyword, firstSecurityKeyword + MAX_SECURITY_CODE_SCAN_LENGTH);

  const match = scanBody.match(KEYWORD_OTP_PATTERN);

  if (match) {
    const digits = match[1].replace(/\D/g, "");
    if (digits.length >= 4 && digits.length <= 8) return digits;
  }

  const standalone = scanBody.match(STANDALONE_SIX_DIGIT_PATTERN);
  if (standalone) return standalone[1];

  return null;
}
