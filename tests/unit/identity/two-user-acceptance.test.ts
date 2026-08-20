import { beforeEach, describe, expect, it } from "vitest";

import { registerWithPassword } from "@/server/api/auth/registration-service";
import {
  authenticateWithPassword,
  logoutSession,
  parseSessionCookie,
  validateSession,
} from "@/server/api/auth/session-service";
import { initializeMailboxPolicyDefaults } from "@/server/api/account-provisioning";
import { toPublicProfile, toPublicUser, type User } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import { getMailboxPolicy, getPolicyWriteIntent, setSenderRule } from "@/server/api/policy-service";
import { requireActorMatches } from "@/server/api/actor";
import type { ApiContext } from "@/server/api/context";

import {
  ALICE_FIXTURE,
  BOB_FIXTURE,
  EXPECTED_BETA_DEFAULT_POLICY,
  assertNoSecretsLeaked,
  captureRedactedFailureArtifact,
  createTestKeypair,
  isLiveTestnetMode,
} from "../../fixtures/identity";

describe("BETA-025 (Issue #1932): Two-User Identity Acceptance Suite", () => {
  let repository: MemoryApiRepository;

  function createMockContext(actorAddress?: string): ApiContext {
    return {
      repository,
      isAuthenticated: Boolean(actorAddress),
      principal: actorAddress
        ? {
            address: actorAddress,
            authMethod: "stellar_header",
            type: "user",
          }
        : null,
      requestId: "req_test",
      headers: new Headers(),
    } as unknown as ApiContext;
  }

  beforeEach(() => {
    repository = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repository;
  });

  describe("1. Isolated Registration & Verification Flow", () => {
    it("allows Alice and Bob to register independently and receive isolated records", async () => {
      const mockContext = createMockContext();

      // 1. Register Alice
      const aliceReg = await registerWithPassword(mockContext, ALICE_FIXTURE, "192.0.2.1");
      expect(aliceReg.accountStatus).toBe("pending_verification");
      expect(aliceReg.email).toBe("alice@stealth.mail");
      expect(aliceReg.username).toBe("alice_smith");
      expect(aliceReg.maskedEmail).toBe("al•••@stealth.mail");

      // Verify Alice stored record
      const aliceUser = await repository.getUserByEmail("alice@stealth.mail");
      expect(aliceUser).not.toBeNull();
      expect(aliceUser?.userId).toMatch(/^usr_[a-f0-9]+$/);
      expect(aliceUser?.address).toMatch(/^G[A-Z2-7]{55}$/);
      expect(aliceUser?.status).toBe("pending_verification");

      // 2. Register Bob
      const bobReg = await registerWithPassword(mockContext, BOB_FIXTURE, "192.0.2.2");
      expect(bobReg.accountStatus).toBe("pending_verification");
      expect(bobReg.email).toBe("bob@stealth.mail");
      expect(bobReg.username).toBe("bob_jones");

      // Verify Bob stored record
      const bobUser = await repository.getUserByEmail("bob@stealth.mail");
      expect(bobUser).not.toBeNull();
      expect(bobUser?.userId).toMatch(/^usr_[a-f0-9]+$/);
      expect(bobUser?.address).toMatch(/^G[A-Z2-7]{55}$/);
      expect(bobUser?.status).toBe("pending_verification");

      // Assert complete isolation of identities
      expect(aliceUser?.userId).not.toBe(bobUser?.userId);
      expect(aliceUser?.address).not.toBe(bobUser?.address);
      expect(aliceUser?.email).not.toBe(bobUser?.email);
      expect(aliceUser?.username).not.toBe(bobUser?.username);

      // Verify credential isolation
      const aliceCred = await repository.getCredential(aliceUser!.userId);
      const bobCred = await repository.getCredential(bobUser!.userId);
      expect(aliceCred).not.toBeNull();
      expect(bobCred).not.toBeNull();
      expect(aliceCred?.credentialId).not.toBe(bobCred?.credentialId);
      expect(aliceCred?.secretHash).not.toBe(bobCred?.secretHash);
      expect(aliceCred?.walletKeyRef).toBe(`wallet:managed:${aliceUser!.userId}`);
      expect(bobCred?.walletKeyRef).toBe(`wallet:managed:${bobUser!.userId}`);
    });

    it("prevents duplicate registration with conflicting email or username", async () => {
      const mockContext = createMockContext();
      await registerWithPassword(mockContext, ALICE_FIXTURE, "192.0.2.1");

      // Duplicate email attempt
      await expect(
        registerWithPassword(
          mockContext,
          {
            ...BOB_FIXTURE,
            email: "alice@stealth.mail",
          },
          "192.0.2.3",
        ),
      ).rejects.toThrow(ApiError);

      // Duplicate username attempt
      await expect(
        registerWithPassword(
          mockContext,
          {
            ...BOB_FIXTURE,
            username: "alice_smith",
          },
          "192.0.2.3",
        ),
      ).rejects.toThrow(ApiError);
    });

    it("verifies and activates Alice and Bob accounts independently", async () => {
      const mockContext = createMockContext();
      await registerWithPassword(mockContext, ALICE_FIXTURE, "192.0.2.1");
      await registerWithPassword(mockContext, BOB_FIXTURE, "192.0.2.2");

      const aliceUser = (await repository.getUserByEmail("alice@stealth.mail"))!;
      const bobUser = (await repository.getUserByEmail("bob@stealth.mail"))!;

      // Activate Alice
      const aliceActivation = await repository.updateUser(
        { ...aliceUser, status: "active" },
        aliceUser.version,
      );
      expect(aliceActivation.updated).toBe(true);
      if (aliceActivation.updated) {
        expect(aliceActivation.user.status).toBe("active");
      }

      // Verify Bob remains pending until explicitly activated
      const bobCheck = await repository.getUserById(bobUser.userId);
      expect(bobCheck?.status).toBe("pending_verification");

      // Activate Bob
      const bobActivation = await repository.updateUser(
        { ...bobUser, status: "active" },
        bobUser.version,
      );
      expect(bobActivation.updated).toBe(true);
      if (bobActivation.updated) {
        expect(bobActivation.user.status).toBe("active");
      }
    });
  });

  describe("2. Mailbox Policy Provisioning & Testnet Account Defaults", () => {
    it("provisions unique default mailbox policies and scheduled testnet write intents for both users", async () => {
      const mockContext = createMockContext();
      await registerWithPassword(mockContext, ALICE_FIXTURE);
      await registerWithPassword(mockContext, BOB_FIXTURE);

      const aliceUser = (await repository.getUserByEmail("alice@stealth.mail"))!;
      const bobUser = (await repository.getUserByEmail("bob@stealth.mail"))!;

      // Provision Alice
      const aliceProvision = await initializeMailboxPolicyDefaults(repository, aliceUser.address);
      expect(aliceProvision.provisioned).toBe(true);
      expect(aliceProvision.source).toBe("default");
      expect(aliceProvision.offchainVersion).toBe(1);
      expect(aliceProvision.scheduled).toBe(true);
      expect(aliceProvision.policy).toMatchObject(EXPECTED_BETA_DEFAULT_POLICY);

      // Provision Bob
      const bobProvision = await initializeMailboxPolicyDefaults(repository, bobUser.address);
      expect(bobProvision.provisioned).toBe(true);
      expect(bobProvision.source).toBe("default");
      expect(bobProvision.offchainVersion).toBe(1);
      expect(bobProvision.scheduled).toBe(true);
      expect(bobProvision.policy).toMatchObject(EXPECTED_BETA_DEFAULT_POLICY);

      // Assert independent intents in repository
      const aliceIntent = await getPolicyWriteIntent(repository, aliceUser.address);
      const bobIntent = await getPolicyWriteIntent(repository, bobUser.address);

      expect(aliceIntent).not.toBeNull();
      expect(bobIntent).not.toBeNull();
      expect(aliceIntent?.owner).toBe(aliceUser.address);
      expect(bobIntent?.owner).toBe(bobUser.address);
      expect(aliceIntent?.offchainVersion).toBe(1);
      expect(bobIntent?.offchainVersion).toBe(1);

      // Idempotency check: repeated provisioning is safe and does not duplicate or bump version
      const aliceRetry = await initializeMailboxPolicyDefaults(repository, aliceUser.address);
      expect(aliceRetry.provisioned).toBe(false);
      expect(aliceRetry.scheduled).toBe(false);
      expect(aliceRetry.offchainVersion).toBe(1);
    });
  });

  describe("3. Authentication, Session Isolation & Logout", () => {
    let aliceUser: User;
    let bobUser: User;

    beforeEach(async () => {
      const mockContext = createMockContext();
      await registerWithPassword(mockContext, ALICE_FIXTURE);
      await registerWithPassword(mockContext, BOB_FIXTURE);

      aliceUser = (await repository.getUserByEmail("alice@stealth.mail"))!;
      bobUser = (await repository.getUserByEmail("bob@stealth.mail"))!;

      // Activate both
      await repository.updateUser({ ...aliceUser, status: "active" }, aliceUser.version);
      await repository.updateUser({ ...bobUser, status: "active" }, bobUser.version);

      aliceUser = (await repository.getUserById(aliceUser.userId))!;
      bobUser = (await repository.getUserById(bobUser.userId))!;
    });

    it("issues isolated sessions and prevents cross-session leakage", async () => {
      const mockContext = createMockContext();

      // Alice logs in
      const aliceAuth = await authenticateWithPassword(mockContext, {
        identifier: ALICE_FIXTURE.email,
        password: ALICE_FIXTURE.password,
        ip: "192.0.2.10",
        userAgent: "StealthBrowser/Alice",
      });

      // Bob logs in
      const bobAuth = await authenticateWithPassword(mockContext, {
        identifier: BOB_FIXTURE.email,
        password: BOB_FIXTURE.password,
        ip: "192.0.2.20",
        userAgent: "StealthBrowser/Bob",
      });

      expect(aliceAuth.session.sessionId).not.toBe(bobAuth.session.sessionId);
      expect(aliceAuth.session.userId).toBe(aliceUser.userId);
      expect(bobAuth.session.userId).toBe(bobUser.userId);

      // Extract session IDs
      const aliceSessionId = parseSessionCookie(aliceAuth.cookieHeader);
      const bobSessionId = parseSessionCookie(bobAuth.cookieHeader);

      expect(aliceSessionId).toBe(aliceAuth.session.sessionId);
      expect(bobSessionId).toBe(bobAuth.session.sessionId);

      // Validate Alice session
      const aliceValidated = await validateSession(mockContext, aliceSessionId!);
      expect(aliceValidated).not.toBeNull();
      expect(aliceValidated?.user.userId).toBe(aliceUser.userId);
      expect(aliceValidated?.user.username).toBe(ALICE_FIXTURE.username);

      // Validate Bob session
      const bobValidated = await validateSession(mockContext, bobSessionId!);
      expect(bobValidated).not.toBeNull();
      expect(bobValidated?.user.userId).toBe(bobUser.userId);
      expect(bobValidated?.user.username).toBe(BOB_FIXTURE.username);

      // Alice logs out
      const logoutResult = await logoutSession(mockContext, aliceSessionId!);
      expect(logoutResult.cookieHeaders.length).toBeGreaterThan(0);
      expect(logoutResult.cookieHeader).toContain("Max-Age=0");

      // Alice session is invalidated
      const aliceAfterLogout = await validateSession(mockContext, aliceSessionId!);
      expect(aliceAfterLogout).toBeNull();

      // Bob session remains active and fully functional
      const bobAfterAliceLogout = await validateSession(mockContext, bobSessionId!);
      expect(bobAfterAliceLogout).not.toBeNull();
      expect(bobAfterAliceLogout?.user.userId).toBe(bobUser.userId);

      // Bob logs out
      const bobLogout = await logoutSession(mockContext, bobSessionId!);
      expect(bobLogout.cookieHeaders.length).toBeGreaterThan(0);

      const bobAfterLogout = await validateSession(mockContext, bobSessionId!);
      expect(bobAfterLogout).toBeNull();
    });
  });

  describe("4. Cross-Account Authorization & Mutation Denial", () => {
    let aliceUser: User;
    let bobUser: User;

    beforeEach(async () => {
      const mockContext = createMockContext();
      await registerWithPassword(mockContext, ALICE_FIXTURE);
      await registerWithPassword(mockContext, BOB_FIXTURE);

      aliceUser = (await repository.getUserByEmail("alice@stealth.mail"))!;
      bobUser = (await repository.getUserByEmail("bob@stealth.mail"))!;

      await repository.updateUser({ ...aliceUser, status: "active" }, aliceUser.version);
      await repository.updateUser({ ...bobUser, status: "active" }, bobUser.version);

      await initializeMailboxPolicyDefaults(repository, aliceUser.address);
      await initializeMailboxPolicyDefaults(repository, bobUser.address);
    });

    it("prevents Alice from mutating or claiming Bob's mailbox policy", async () => {
      const aliceContext = createMockContext(aliceUser.address);

      // Alice tries to act on Bob's address
      expect(() => {
        requireActorMatches(aliceContext, bobUser.address);
      }).toThrow(ApiError);

      try {
        requireActorMatches(aliceContext, bobUser.address);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // Bob's policy in repository must remain intact
      const bobPolicy = await getMailboxPolicy(repository, bobUser.address);
      expect(bobPolicy.policy.minimumPostage).toBe("0");
    });

    it("prevents Alice from altering Bob's sender allow/block rules", async () => {
      const aliceContext = createMockContext(aliceUser.address);

      expect(() => {
        requireActorMatches(aliceContext, bobUser.address);
      }).toThrow(ApiError);

      // Mutating as Bob should succeed
      await setSenderRule(repository, bobUser.address, aliceUser.address, "allow");
      const rule = await repository.getSenderRule(bobUser.address, aliceUser.address);
      expect(rule).toBe("allow");
    });

    it("guarantees public projection safety with secret stripping", async () => {
      const aliceProfile = (await repository.getProfile(aliceUser.userId))!;
      const publicUser = toPublicUser(aliceUser);
      const publicProfile = toPublicProfile(aliceProfile);

      expect(publicUser).not.toHaveProperty("secretHash");
      expect(publicUser).not.toHaveProperty("walletKeyRef");
      expect(publicUser).not.toHaveProperty("version");

      expect(publicProfile).toEqual({
        userId: aliceUser.userId,
        username: "alice_smith",
        displayName: "Alice Smith",
        avatarUrl: null,
        avatarMetadata: null,
        bio: null,
        locale: "en-US",
        timezone: "UTC",
        addressDisplay: "full",
        notifications: {
          email: true,
          desktop: true,
          sound: false,
        },
        createdAt: aliceProfile.createdAt,
        updatedAt: aliceProfile.updatedAt,
      });

      assertNoSecretsLeaked(publicUser);
      assertNoSecretsLeaked(publicProfile);
    });
  });

  describe("5. Secrets Redaction & Failure Artifact Safety", () => {
    it("redacts sensitive passwords, keys, and tokens from failure reports", () => {
      const stellarSecretKey = `S${"A".repeat(55)}`;
      const testError = new Error(
        `Authentication failed for user alice_smith with password ${ALICE_FIXTURE.password} and key ${stellarSecretKey}`,
      );

      const context = {
        email: ALICE_FIXTURE.email,
        password: ALICE_FIXTURE.password,
        secretHash: "argon2id$v=19$hash:salt",
        cookie: "stealth_session=sess_1234567890abcdef",
        safeMeta: "public_value",
      };

      const artifact = captureRedactedFailureArtifact(
        "two-user-login-failure-test",
        testError,
        context,
      );

      expect(artifact.testName).toBe("two-user-login-failure-test");
      expect(artifact.errorMessage).not.toContain(ALICE_FIXTURE.password);
      expect(artifact.errorMessage).toContain("[REDACTED_PASSWORD]");
      expect(artifact.errorMessage).toContain("[REDACTED_STELLAR_SECRET]");

      expect(artifact.sanitizedContext.password).toBe("[REDACTED_SECRET]");
      expect(artifact.sanitizedContext.secretHash).toBe("[REDACTED_SECRET]");
      expect(artifact.sanitizedContext.cookie).toBe("stealth_session=[REDACTED_TOKEN]");
      expect(artifact.sanitizedContext.safeMeta).toBe("public_value");

      assertNoSecretsLeaked(artifact);
    });
  });

  describe("6. Freighter-Independence & Live Testnet Mode Compatibility", () => {
    it("runs completely in non-Freighter environments without window.freighter", () => {
      expect(typeof (globalThis as any).window).toBe("undefined");
      expect((globalThis as any).freighter).toBeUndefined();

      const keypair = createTestKeypair("A");
      expect(keypair.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
      expect(keypair.secretKey).toMatch(/^S[A-Z2-7]{55}$/);
    });

    it("verifies deterministic test mode in CI and opt-in testnet mode", () => {
      const isLive = isLiveTestnetMode();
      expect(typeof isLive).toBe("boolean");

      const alicePair = createTestKeypair("A");
      const bobPair = createTestKeypair("B");

      expect(alicePair.publicKey).not.toBe(bobPair.publicKey);
      expect(alicePair.secretKey).not.toBe(bobPair.secretKey);
    });
  });
});
