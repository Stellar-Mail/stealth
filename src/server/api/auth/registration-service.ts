import type { RegistrationRequest, RegistrationResponse } from "@/features/identity/registration";
import { maskEmail } from "@/features/identity/registration";
import { loadRuntimeConfig } from "@/config";
import type { ApiContext } from "../context";
import type { Credential, Profile, User } from "../domain";
import { ApiError } from "../errors";
import { hashPassword } from "./password";
import { provisionManagedStellarWallet } from "../account-provisioning";
import { prepareManagedWalletSecret } from "@/services/stellar/account-provision";
import { createFundingAdapter } from "@/services/stellar/funding-adapter";

const SIGNUP_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const MAX_SIGNUPS_PER_IP = 10;

export async function registerWithPassword(
  apiContext: ApiContext,
  input: RegistrationRequest,
  ip = "unknown",
): Promise<RegistrationResponse> {
  const rateLimitKey = `signup:${ip}`;
  if ((await apiContext.repository.getCounter(rateLimitKey)) >= MAX_SIGNUPS_PER_IP) {
    throw new ApiError("too_many_requests", {
      retryAfterSeconds: SIGNUP_RATE_LIMIT_WINDOW_SECONDS,
    });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const userId = `usr_${crypto.randomUUID().replace(/-/g, "")}`;
  const { hash, salt } = await hashPassword(input.password);

  const config = loadRuntimeConfig();
  const storageSecret = config.secrets?.storageSecret ?? "dev-storage-secret-change-me";
  const prepared = await prepareManagedWalletSecret({
    userId,
    storageSecret,
    now,
  });

  const user: User = {
    userId,
    address: prepared.address,
    email: input.email,
    username: input.username,
    status: "pending_verification",
    createdAt: nowIso,
    updatedAt: nowIso,
    version: 1,
  };
  const credential: Credential = {
    credentialId: `cred_${crypto.randomUUID().replace(/-/g, "")}`,
    userId,
    authMethod: "password_hash",
    secretHash: `${hash}:${salt}`,
    walletKeyRef: `pending_${userId}`,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const profile: Profile = {
    userId,
    username: input.username,
    displayName: input.displayName,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await apiContext.repository.createUser(user, credential, profile);
  } catch (error) {
    if (error instanceof ApiError && error.code === "conflict") {
      throw new ApiError("conflict");
    }
    throw error;
  }

  await provisionManagedStellarWallet(apiContext.repository, userId, config, {
    fundingAdapter: createFundingAdapter({
      useFake: config.profile === "development" || config.profile === "test",
    }),
    storageSecret,
    now,
    prepared,
    accountId: userId,
    origin: ip,
  });

  await apiContext.repository.incrementCounter(rateLimitKey, SIGNUP_RATE_LIMIT_WINDOW_SECONDS, 1);
  return {
    accountStatus: "pending_verification",
    email: user.email,
    maskedEmail: maskEmail(user.email),
    username: user.username,
  };
}
