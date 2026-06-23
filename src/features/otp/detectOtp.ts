/**
 * Detect an OTP, passkey, or verification code in an email body.
 * Returns the digits string (4-8) or null.
 */
export function detectOtp(body: string): string | null {
  if (!body) return null;

  // Keep detection conservative to avoid false positives.
  // We require explicit intent labels (OTP / passkey / verification / security code)
  // instead of matching generic "code" / "pin" alone.
  const contextOtp =
    /(?:^|[\s\p{P}\p{S}])(?:otp|one[-\s]?time(?:\s+password)?|passkey|pass\s?code|verification(?:\s+code)?|security\s+code)(?:\b|\s)[^\d]{0,80}((?:\d[\s-]?){4,8})(?=$|[\s\p{P}\p{S}])/imu;

  // Numeric value directly after the label.
  const contextOnlyValue =
    /(?:otp|one[-\s]?time(?:\s+password)?|passkey|pass\s?code|verification(?:\s+code)?|security\s+code)(?:\b|\s)[^\d]{0,30}(\d{4,8}(?:[\s-]\d{1,4})*)/imu;

  const match = body.match(contextOtp) ?? body.match(contextOnlyValue);
  if (match) {
    const digits = match[1].replace(/\D/g, "");
    if (digits.length >= 4 && digits.length <= 8) return digits;
  }

  // Fallback: common OTP emails often contain a 6-digit code on its own line.
  // Keep it strict: only accept if there's an OTP-related hint near the line.
  const standalone = body.match(/(?:^|\n)\s*(\d{6})\s*(?:\n|$)/);
  if (standalone) {
    const line = standalone[0];
    const idx = body.indexOf(line);
    const window = body.slice(
      Math.max(0, idx - 120),
      Math.min(body.length, idx + line.length + 120),
    );

    if (/(otp|one[-\s]?time|passcode|verification|security\s+code|pass\s?code)/i.test(window)) {
      return standalone[1];
    }
  }

  return null;
}

