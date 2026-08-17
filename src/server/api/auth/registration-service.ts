import type { RegistrationRequest, RegistrationResponse } from "@/features/identity/registration";
import { maskEmail } from "@/features/identity/registration";
import type { ApiContext } from "../context";
import type { Credential, Profile, User } from "../domain";
import { ApiError } from "../errors";
import { hashPassword } from "./password";

const SIGNUP_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const MAX_SIGNUPS_PER_IP = 10;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generatedAccountAddress(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(55));
  return `G${Array.from(bytes, (byte) => BASE32[byte % BASE32.length]).join("")}`;
}

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

  const now = new Date().toISOString();
  const userId = `usr_${crypto.randomUUID().replace(/-/g, "")}`;
  const { hash, salt } = await hashPassword(input.password);
  const user: User = {
    userId,
    // This is an internal unique placeholder, not an external wallet connection.
    address: generatedAccountAddress(),
    email: input.email,
    username: input.username,
    status: "pending_verification",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  const credential: Credential = {
    credentialId: `cred_${crypto.randomUUID().replace(/-/g, "")}`,
    userId,
    authMethod: "password_hash",
    secretHash: `${hash}:${salt}`,
    walletKeyRef: `pending_${userId}`,
    createdAt: now,
    updatedAt: now,
  };
  const profile: Profile = {
    userId,
    username: input.username,
    displayName: input.displayName,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await apiContext.repository.createUser(user, credential, profile);
  } catch (error) {
    if (error instanceof ApiError && error.code === "conflict") {
      // Keep email and username ownership private.
      throw new ApiError("conflict");
    }
    throw error;
  }

  await apiContext.repository.incrementCounter(rateLimitKey, SIGNUP_RATE_LIMIT_WINDOW_SECONDS, 1);
  return {
    accountStatus: "pending_verification",
    email: user.email,
    maskedEmail: maskEmail(user.email),
    username: user.username,
  };
}
