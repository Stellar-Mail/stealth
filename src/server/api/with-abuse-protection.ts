import type { ApiRepository } from "./repository";

export type AbusePolicy = {
  checkAccount: boolean;
  checkIp: boolean;
  checkDevice: boolean;
  checkSenderRecipient: boolean;
  checkRelay: boolean;
};

export type AbuseContext = {
  actorId?: string;
  sender: string;
  recipient: string;
  ip: string;
  fingerprint: string;
  relayId: string;
};

export async function withAbuseProtection<T>(
  repository: ApiRepository,
  policy: AbusePolicy,
  context: AbuseContext,
  handler: () => Promise<T>,
): Promise<T> {
  // Execute rate-limiting/abuse validation rules here if needed...
  return handler();
}
