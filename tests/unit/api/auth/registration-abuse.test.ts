import { describe, expect, it } from "vitest";

import {
  checkEmailDomainLimit,
  checkInviteCode,
  checkPasswordResetAbuse,
  checkTestnetFundingAbuse,
  checkUsernameReservationLimit,
  checkVerificationTokenAbuse,
  createChallengeNonce,
  recordVerificationTokenFailure,
  validateChallengeSolution,
} from "@/server/api/abuse-service";
import { MemoryApiRepository } from "@/server/api/memory-repository";

describe("BETA-079 Registration & Account Recovery Hardening Controls", () => {
  it("blocks disposable email domains during signup check", async () => {
    const repository = new MemoryApiRepository();
    const result = await checkEmailDomainLimit(repository, "attacker@mailinator.com");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("disposable_email_blocked");
  });

  it("allows valid non-disposable email domain signups under budget", async () => {
    const repository = new MemoryApiRepository();
    const result = await checkEmailDomainLimit(repository, "user@gmail.com");
    expect(result.allowed).toBe(true);
  });

  it("enforces invite code check when enabled", async () => {
    const repository = new MemoryApiRepository();
    const resultNoCode = await checkInviteCode(repository, undefined, { inviteCodeRequired: true });
    expect(resultNoCode.allowed).toBe(false);
    expect(resultNoCode.reason).toBe("invite_code_required");

    const resultInvalid = await checkInviteCode(repository, "INVALID_CODE", {
      inviteCodeRequired: true,
    });
    expect(resultInvalid.allowed).toBe(false);
    expect(resultInvalid.reason).toBe("invite_code_invalid");

    const resultValid = await checkInviteCode(repository, "STEALTH_BETA_2026", {
      inviteCodeRequired: true,
    });
    expect(resultValid.allowed).toBe(true);
  });

  it("locks verification token after exceeding max failed attempts", async () => {
    const repository = new MemoryApiRepository();
    const tokenKey = "user@test.mail:tok12345";
    const ip = "192.168.1.100";

    for (let i = 0; i < 5; i++) {
      await recordVerificationTokenFailure(repository, tokenKey);
    }

    const check = await checkVerificationTokenAbuse(repository, tokenKey, ip);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe("token_locked_max_attempts");
  });

  it("enforces testnet funding limits per account and per IP", async () => {
    const repository = new MemoryApiRepository();
    const account = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const ip = "203.0.113.10";

    const first = await checkTestnetFundingAbuse(repository, account, ip);
    expect(first.allowed).toBe(true);

    const second = await checkTestnetFundingAbuse(repository, account, ip);
    expect(second.allowed).toBe(false);
  });

  it("creates and validates vendor-free proof-of-work challenges", () => {
    const challenge = createChallengeNonce();
    expect(challenge.challengeId).toBeDefined();

    // Invalid solution (empty string always fails)
    expect(validateChallengeSolution(challenge.challengeId, "", 2)).toBe(false);

    // Compute valid nonce
    let validNonce = 0;
    while (!validateChallengeSolution(challenge.challengeId, validNonce.toString(), 2)) {
      validNonce++;
    }
    expect(validateChallengeSolution(challenge.challengeId, validNonce.toString(), 2)).toBe(true);

    // Verify that a wrong nonce does not validate (use difficulty 4 for reliability)
    expect(validateChallengeSolution(challenge.challengeId, "wrong_nonce", 4)).toBe(false);
  });

  it("enforces password reset IP and account limits", async () => {
    const repository = new MemoryApiRepository();
    const email = "user@stealth.mail";
    const ip = "198.51.100.5";

    for (let i = 0; i < 3; i++) {
      const check = await checkPasswordResetAbuse(repository, email, ip);
      expect(check.allowed).toBe(true);
    }

    const fourth = await checkPasswordResetAbuse(repository, email, ip);
    expect(fourth.allowed).toBe(false);
  });

  it("enforces username reservation rate limit per IP", async () => {
    const repository = new MemoryApiRepository();
    const ip = "203.0.113.50";

    // First 10 reservations should be allowed
    for (let i = 0; i < 10; i++) {
      const check = await checkUsernameReservationLimit(repository, ip);
      expect(check.allowed).toBe(true);
    }

    // 11th should be blocked
    const eleventh = await checkUsernameReservationLimit(repository, ip);
    expect(eleventh.allowed).toBe(false);
  });

  it("allows username reservations from different IPs", async () => {
    const repository = new MemoryApiRepository();
    const ip1 = "203.0.113.100";
    const ip2 = "203.0.113.101";

    // IP1 makes some reservations
    for (let i = 0; i < 5; i++) {
      await checkUsernameReservationLimit(repository, ip1);
    }

    // IP2 should still be able to make reservations
    const ip2Check = await checkUsernameReservationLimit(repository, ip2);
    expect(ip2Check.allowed).toBe(true);
  });
});
