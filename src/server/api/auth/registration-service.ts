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
import { checkIpLimit } from "../abuse-service";
import type { DeliveryReceipt, VerificationEmailMessage } from "@/services/notifications";
import {
  buildVerificationUrl,
  issueEmailVerificationToken,
  type VerificationPolicy,
} from "../verification-service";
import { recordAuditEvent } from "../audit";

const SIGNUP_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const MAX_SIGNUPS_PER_IP = 10;

export type RegistrationDelivery = (message: VerificationEmailMessage) => Promise<DeliveryReceipt>;

export async function registerWithPassword(
  apiContext: ApiContext,
  input: RegistrationRequest,
  ip = "unknown",
  deviceFingerprint = "unknown",
  options?: {
    deliver?: RegistrationDelivery;
    appUrl?: string;
    verificationPolicy?: VerificationPolicy;
  },
): Promise<RegistrationResponse> {
  const ipCheck = await checkIpLimit(
    apiContext.repository,
    ip,
    "registration",
    5,
    SIGNUP_RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!ipCheck.allowed) {
    throw new ApiError(429, "too_many_requests", "Registration rate limit exceeded for IP", {
      retryAfterSeconds: ipCheck.retryAfterSeconds ?? SIGNUP_RATE_LIMIT_WINDOW_SECONDS,
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
    locale: "en-US",
    timezone: "UTC",
    addressDisplay: "full",
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

  // BETA-091: Issue and deliver verification after account creation. Delivery
  // failure must not reveal tokens or change the generic registration result;
  // the account remains pending_verification and the user can resend.
  if (options?.deliver && options.appUrl) {
    try {
      const issued = await issueEmailVerificationToken(
        apiContext,
        userId,
        options.verificationPolicy,
      );
      const verificationUrl = buildVerificationUrl(
        options.appUrl,
        user.email,
        issued.plaintextToken,
      );
      const receipt = await options.deliver({
        to: user.email,
        purpose: "email_verification",
        verificationUrl,
        expiresAt: issued.expiresAt,
      });
      recordAuditEvent({
        actor: userId,
        action: receipt.accepted
          ? "auth.verification_token_issued"
          : "auth.verification_delivery_failed",
        targetType: "verification_token",
        safeTargetReference: issued.tokenHash,
        result: receipt.accepted ? "success" : "denied",
        requestId: apiContext.requestId ?? "registration",
      });
    } catch {
      recordAuditEvent({
        actor: userId,
        action: "auth.verification_delivery_failed",
        targetType: "account",
        safeTargetReference: userId,
        result: "denied",
        requestId: apiContext.requestId ?? "registration",
      });
    }
  }

  return {
    accountStatus: "pending_verification",
    email: user.email,
    maskedEmail: maskEmail(user.email),
    username: user.username,
  };
}
