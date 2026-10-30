import type { Email } from "@/components/mail/data";
import { getTrustStates } from "@/components/mail/trust-state";
import type { CriticalAlertPreferences } from "@/features/preferences/types";

export function getCriticalMailWarning(
  email: Email,
  preferences?: CriticalAlertPreferences,
  authenticityWarning?: string | null,
): string | null {
  if (!preferences?.enabled) return null;
  if (preferences.failedVerification && (email.quarantineRecord || authenticityWarning)) {
    return (
      email.quarantineRecord?.userHeadline ?? authenticityWarning ?? "Message verification failed."
    );
  }
  if (
    preferences.unknownSenders &&
    email.senderPolicy !== "allow" &&
    !getTrustStates(email).includes("verified")
  ) {
    return "This sender is not verified or in your allowed contacts.";
  }
  return null;
}
