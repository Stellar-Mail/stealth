import { createHash } from "node:crypto";

import type { ApiRepository } from "./repository";

function rateLimited(retryAfterSeconds: number) {
  return { allowed: false, retryAfterSeconds };
}

async function checkIncrementedLimit(
  repository: ApiRepository,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const count = await repository.incrementCounter(key, windowSeconds);
  if (count > max) return rateLimited(windowSeconds);
  return { allowed: true };
}

async function checkStoredLimit(
  repository: ApiRepository,
  key: string,
  max: number,
  retryAfterSeconds: number,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const count = await repository.getCounter(key);
  if (count >= max) return rateLimited(retryAfterSeconds);
  return { allowed: true };
}

function normalizeFingerprintField(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

export function buildDeviceFingerprint(headers: {
  userAgent?: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
  ipPrefix?: string;
}): string {
  const payload = [
    normalizeFingerprintField(headers.userAgent),
    normalizeFingerprintField(headers.acceptLanguage),
    normalizeFingerprintField(headers.acceptEncoding),
    normalizeFingerprintField(headers.ipPrefix),
  ].join("|");

  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export async function checkAccountLimit(
  repository: ApiRepository,
  sender: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  return checkIncrementedLimit(repository, `abuse:account:${sender}`, 50, 3600);
}

export async function checkIpLimit(
  repository: ApiRepository,
  ip: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number; flagged?: boolean }> {
  if (ip === "" || ip === "unknown") {
    return { allowed: true, flagged: true };
  }

  return checkIncrementedLimit(repository, `abuse:ip:${ip}`, 100, 3600);
}

export async function checkSenderRecipientLimit(
  repository: ApiRepository,
  sender: string,
  recipient: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  return checkIncrementedLimit(repository, `abuse:pair:${sender}:${recipient}`, 10, 3600);
}

export async function checkProofFailureLimit(
  repository: ApiRepository,
  sender: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  return checkStoredLimit(repository, `abuse:proof:${sender}`, 5, 900);
}

export async function recordProofFailure(repository: ApiRepository, sender: string): Promise<void> {
  await repository.incrementCounter(`abuse:proof:${sender}`, 900);
}

export async function checkRelayLimit(
  repository: ApiRepository,
  relayId: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  return checkIncrementedLimit(repository, `abuse:relay:${relayId}`, 500, 3600);
}

export async function checkDeviceLimit(
  repository: ApiRepository,
  fingerprint: string,
  opts?: { windowMs?: number; max?: number },
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const windowMs = opts?.windowMs ?? 60_000;
  const max = opts?.max ?? 30;
  const count = await repository.incrementCounter(`device:${fingerprint}`, windowMs / 1000);
  if (count > max) return { allowed: false, retryAfterSeconds: windowMs / 1000 };
  return { allowed: true };
}
