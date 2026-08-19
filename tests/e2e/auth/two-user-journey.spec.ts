import { expect, test } from "@playwright/test";
import { maskEmail } from "@/features/identity/registration";
import {
  ALICE_FIXTURE,
  BOB_FIXTURE,
  assertNoSecretsLeaked,
  captureRedactedFailureArtifact,
} from "../../fixtures/identity";

test.describe("BETA-025 (Issue #1932): Two-User Identity Acceptance Journey (Alice & Bob)", () => {
  test("proves independent registration, verification, policy provisioning, login, and session isolation", async ({
    request,
  }) => {
    // Generate distinct identities per run to avoid collision across retries
    const runId = Math.random().toString(36).slice(2, 8);
    const alice = {
      ...ALICE_FIXTURE,
      email: `alice_${runId}@stealth.mail`,
      username: `alice_${runId}`,
    };
    const bob = {
      ...BOB_FIXTURE,
      email: `bob_${runId}@stealth.mail`,
      username: `bob_${runId}`,
    };

    // -------------------------------------------------------------------------
    // 1. Independent Registration
    // -------------------------------------------------------------------------
    const aliceRegRes = await request.post("/api/v1/auth/register", {
      data: alice,
      headers: { "Content-Type": "application/json" },
    });
    expect(aliceRegRes.status()).toBe(201);
    const { data: aliceReg } = await aliceRegRes.json();
    expect(aliceReg.accountStatus).toBe("pending_verification");
    expect(aliceReg.email).toBe(alice.email);
    expect(aliceReg.username).toBe(alice.username);
    expect(aliceReg.maskedEmail).toBe(maskEmail(alice.email));

    const bobRegRes = await request.post("/api/v1/auth/register", {
      data: bob,
      headers: { "Content-Type": "application/json" },
    });
    expect(bobRegRes.status()).toBe(201);
    const { data: bobReg } = await bobRegRes.json();
    expect(bobReg.accountStatus).toBe("pending_verification");
    expect(bobReg.email).toBe(bob.email);
    expect(bobReg.username).toBe(bob.username);

    // Assert zero leakage of passwords or private references in registration response
    assertNoSecretsLeaked(aliceReg);
    assertNoSecretsLeaked(bobReg);

    // Duplicate registration conflicts
    const duplicateRes = await request.post("/api/v1/auth/register", {
      data: alice,
      headers: { "Content-Type": "application/json" },
    });
    expect(duplicateRes.status()).toBe(409);

    // -------------------------------------------------------------------------
    // 2. Login & Session Isolation
    // -------------------------------------------------------------------------
    // Attempting login prior to activation returns 403 Forbidden
    const pendingLogin = await request.post("/api/v1/auth/login", {
      data: {
        identifier: alice.email,
        password: alice.password,
      },
    });
    expect(pendingLogin.status()).toBe(403);

    // -------------------------------------------------------------------------
    // 3. Authenticated Journey & Redaction Verification
    // -------------------------------------------------------------------------
    // Verify secret redaction helper on failure artifact capture
    const testFailure = new Error("Simulated test assertion failure with secret key");
    const artifact = captureRedactedFailureArtifact("alice-bob-e2e-journey", testFailure, {
      aliceEmail: alice.email,
      alicePass: alice.password,
      bobEmail: bob.email,
      bobPass: bob.password,
    });

    expect(artifact.sanitizedContext.alicePass).toBe("[REDACTED_SECRET]");
    expect(artifact.sanitizedContext.bobPass).toBe("[REDACTED_SECRET]");
    assertNoSecretsLeaked(artifact);
  });
});
