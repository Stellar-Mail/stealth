export const MAIL_DOMAIN = "betasmail.com";

export const LOCAL_MAIL_DOMAINS = [
  MAIL_DOMAIN,
  "smail.com",
  "stealth.me",
  "stealth.xyz",
  "stealth.mail",
  "stealth.local",
  "localhost",
] as const;

export function formatMailAddress(username: string): string {
  return `${username}@${MAIL_DOMAIN}`;
}

export function formatFederationAddress(username: string): string {
  return `${username}*${MAIL_DOMAIN}`;
}
