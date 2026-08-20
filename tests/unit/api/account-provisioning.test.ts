import { expect, describe, it, beforeEach } from "vitest";

import { MemoryApiRepository } from "@/server/api/memory-repository";
import {
  getProvisioningProgress,
  initializeMailboxPolicyDefaults,
  MAX_PROVISIONING_ATTEMPTS,
  PROVISIONING_STEPS,
  provisionAccount,
  retryAccountProvisioning,
  USERNAME_RESERVATION_LEASE_MS,
} from "@/server/api/account-provisioning";
import { ApiError } from "@/server/api/errors";
import type { ApiRepository, UsernameReservationResult } from "@/server/api/repository";
import type { User } from "@/server/api/domain";
import { userSchema } from "@/server/api/domain";

const ADDR_A = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";
const ADDR_B = "G234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQ";
const EMAIL_A = "alice@stealth.mail";
const NOW = new Date("2026-01-15T12:00:00.000Z");

const INPUT = {
  address: ADDR_A,
  username: "alice_dev",
  email: EMAIL_A,
};

function buildUser(overrides: Partial<User> = {}): User {
  return userSchema.parse({
    userId: "usr_alice",
    address: ADDR_A,
    email: EMAIL_A,
    username: "alice_dev",
    status: "pending_verification",
    createdAt: "2026-01-15T11:00:00.000Z",
    updatedAt: "2026-01-15T11:00:00.000Z",
    version: 1,
    ...overrides,
  });
}

function seedUser(repo: MemoryApiRepository, user: User): Promise<User> {
  return repo.createUser(user);
}

/**
 * Proxy wrapper that fails a single named repository method call with the
 * given error, then delegates everything else (and subsequent calls to the
 * same method) to the inner repository.
 */
function failOnce(repo: ApiRepository, method: string, error: Error): ApiRepository {
  let armed = true;
  return new Proxy(repo, {
    get(target, prop, receiver) {
      if (prop === method) {
        if (armed) {
          armed = false;
          return () => Promise.reject(error);
        }
        return Reflect.get(target, prop, receiver);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Proxy wrapper that fails the named method on every call.
 */
function failAlways(repo: ApiRepository, method: string): ApiRepository {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      if (prop === method) {
        return () => Promise.reject(new ApiError(503, "dependency_unavailable", "down"));
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

const transient = () => new ApiError(503, "dependency_unavailable", "dependency temporarily down");

describe("provisionAccount", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("bootstraps a user and converges all four steps to active without a half-account", async () => {
    const progress = await provisionAccount(repo, { ...INPUT, displayName: "Alice Dev" }, NOW);

    expect(progress.status).toBe("active");
    expect(progress.completedSteps).toEqual([...PROVISIONING_STEPS]);
    expect(progress.attempts).toBe(0);
    expect(progress.failure).toBeNull();

    const user = await repo.getUserByAddress(ADDR_A);
    expect(user).not.toBeNull();
    expect(user!.status).toBe("active");
    expect(user!.username).toBe("alice_dev");
    expect(user!.version).toBe(2);

    const profile = await repo.getProfile(user!.userId);
    expect(profile?.displayName).toBe("Alice Dev");

    const wallet = await repo.getWallet(user!.userId);
    expect(wallet?.address).toBe(ADDR_A);

    const policy = await repo.getPolicy(ADDR_A);
    expect(policy).toEqual({ allowUnknown: true, requireVerified: false, minimumPostage: "0" });

    // The claim is released once the username is permanently bound.
    expect(await repo.getUsernameReservation("alice_dev")).toBeNull();
  });

  it("provisions an existing account without rebinding its username", async () => {
    await seedUser(repo, buildUser());

    const progress = await provisionAccount(
      repo,
      { address: ADDR_A, username: "ignored_input", email: EMAIL_A },
      NOW,
    );

    expect(progress.status).toBe("active");
    const user = await repo.getUserByAddress(ADDR_A);
    expect(user!.username).toBe("alice_dev");
    expect(user!.userId).toBe("usr_alice");
    expect(progress.requestedUsername).toBe("alice_dev");
  });

  it("is idempotent: repeating a successful provision never double-creates resources", async () => {
    const first = await provisionAccount(repo, INPUT, NOW);
    const second = await provisionAccount(repo, INPUT, NOW);

    expect(first.status).toBe("active");
    expect(second.status).toBe("active");
    expect(second).toEqual(first);

    const user = (await repo.getUserByAddress(ADDR_A))!;
    expect(await repo.getWallet(user.userId)).not.toBeNull();
  });

  it("resumes an in-progress record from its completed steps", async () => {
    await provisionAccount(repo, INPUT, NOW);

    const record = (await repo.getProvisioningRecord(
      (await repo.getUserByAddress(ADDR_A))!.userId,
    ))!;
    // Simulate a crash mid-flow: only the first step completed.
    await repo.setProvisioningRecord(
      {
        ...record,
        status: "pending",
        completedSteps: ["username_reservation"],
        currentStep: "profile_defaults",
      },
      record.version,
    );

    const progress = await provisionAccount(repo, INPUT, NOW);
    expect(progress.status).toBe("active");
    expect(progress.completedSteps).toEqual([...PROVISIONING_STEPS]);
  });

  it("is concurrently safe: parallel provisioners converge to one active account, one wallet", async () => {
    const results = await Promise.all([
      provisionAccount(repo, INPUT, NOW),
      provisionAccount(repo, INPUT, NOW),
    ]);
    const statuses = results.map((r) => r.status).sort();
    // Exactly one run wins the username claim; the raced duplicate lands in
    // terminal failed and never creates a second user or wallet.
    expect(statuses).toEqual(["active", "failed"]);

    const active = results.find((r) => r.status === "active")!;
    expect(active.completedSteps).toEqual([...PROVISIONING_STEPS]);

    const user = (await repo.getUserByAddress(ADDR_A))!;
    expect(user.status).toBe("active");
    // Exactly one wallet exists for the sole user.
    expect(await repo.getWallet(user.userId)).not.toBeNull();

    // The claim is not squatted by either run.
    expect(await repo.getUsernameReservation("alice_dev")).toBeNull();
  });
});

describe("failure and compensation paths", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it.each([
    ["username_reservation", "createUser"],
    ["profile_defaults", "setProfile"],
    ["wallet_creation", "createWallet"],
    ["mailbox_policy_init", "setPolicy"],
  ] as const)(
    "transient failure at %s step -> retryable, compensated, account stays pending",
    async (step, method) => {
      const progress = await provisionAccount(failOnce(repo, method, transient()), INPUT, NOW);

      expect(progress.status).toBe("retryable");
      expect(progress.attempts).toBe(1);
      expect(progress.failure?.step).toBe(step);
      expect(progress.failure?.code).toBe("dependency_unavailable");
      expect(progress.completedSteps).toEqual(
        PROVISIONING_STEPS.slice(0, PROVISIONING_STEPS.indexOf(step)),
      );

      // Never a live half-account: either absent or pending_verification.
      const user = await repo.getUserByAddress(ADDR_A);
      if (user) {
        expect(user.status).toBe("pending_verification");
      }

      // Compensation released the username claim so a retry can re-claim it.
      expect(await repo.getUsernameReservation("alice_dev")).toBeNull();
    },
  );

  it("marks the flow failed (terminal) for a permanent username conflict and never activates", async () => {
    await seedUser(
      repo,
      buildUser({
        userId: "usr_bob",
        address: ADDR_B,
        email: "bob@stealth.mail",
        username: "taken_name",
      }),
    );

    const progress = await provisionAccount(
      repo,
      { address: ADDR_A, username: "taken_name", email: EMAIL_A },
      NOW,
    );

    expect(progress.status).toBe("failed");
    expect(progress.attempts).toBe(1);
    expect(progress.failure?.code).toBe("conflict");
    expect(await repo.getUserByAddress(ADDR_A)).toBeNull();
    expect(await repo.getUsernameReservation("taken_name")).toBeNull();
  });

  it("marks the flow failed when the bound username differs from the record's requested username", async () => {
    // A provisioning record is created first (e.g. a signup flow), and a
    // later registration binds the same user id to a different username.
    // The record's claimed username can never be re-bound — permanent.
    await seedUser(repo, buildUser({ username: "alice_old" }));
    await repo.createProvisioningRecord({
      userId: "usr_alice",
      status: "pending",
      requestedUsername: "alice_dev",
      displayName: null,
      completedSteps: [],
      currentStep: "username_reservation",
      attempts: 0,
      failure: null,
      startedAt: "2026-01-15T11:00:00.000Z",
      updatedAt: "2026-01-15T11:00:00.000Z",
      version: 1,
    });

    const progress = await provisionAccount(
      repo,
      { address: ADDR_A, username: "ignored", email: EMAIL_A },
      NOW,
    );

    expect(progress.status).toBe("failed");
    expect(progress.failure?.code).toBe("invalid_state_transition");
    const user = (await repo.getUserByAddress(ADDR_A))!;
    expect(user.username).toBe("alice_old");
    expect(user.status).toBe("pending_verification");
  });

  it("keeps the account pending_verification when activation fails transiently", async () => {
    const progress = await provisionAccount(failOnce(repo, "updateUser", transient()), INPUT, NOW);

    expect(progress.status).toBe("retryable");
    expect(progress.failure?.step).toBe("mailbox_policy_init");
    const user = (await repo.getUserByAddress(ADDR_A))!;
    expect(user.status).toBe("pending_verification");
  });

  it("cannot activate a suspended account (permanent failure)", async () => {
    await seedUser(repo, buildUser({ status: "suspended" }));

    const progress = await provisionAccount(repo, INPUT, NOW);

    expect(progress.status).toBe("failed");
    expect(progress.failure?.code).toBe("invalid_state_transition");
    const user = (await repo.getUserByAddress(ADDR_A))!;
    expect(user.status).toBe("suspended");
  });

  it("exhausts attempts into a terminal failed state and blocks further retries", async () => {
    const failing = failAlways(repo, "setProfile");

    let progress = await provisionAccount(failing, INPUT, NOW);
    expect(progress.status).toBe("retryable");
    expect(progress.attempts).toBe(1);

    const userId = (await repo.getUserByAddress(ADDR_A))!.userId;

    for (let attempt = 2; attempt < MAX_PROVISIONING_ATTEMPTS; attempt += 1) {
      progress = await retryAccountProvisioning(failing, userId, NOW);
      expect(progress.attempts).toBe(attempt);
      expect(progress.status).toBe("retryable");
    }

    // The final allowed retry lands the flow in terminal failed.
    progress = await retryAccountProvisioning(failing, userId, NOW);
    expect(progress.status).toBe("failed");
    expect(progress.attempts).toBe(MAX_PROVISIONING_ATTEMPTS);

    await expect(retryAccountProvisioning(repo, userId, NOW)).rejects.toMatchObject({
      code: "invalid_state_transition",
    });
  });
});

describe("retryAccountProvisioning", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("resumes from the first incomplete step and converges to active", async () => {
    const first = await provisionAccount(failOnce(repo, "createWallet", transient()), INPUT, NOW);
    expect(first.status).toBe("retryable");
    expect(first.completedSteps).toEqual(["username_reservation", "profile_defaults"]);

    const user = (await repo.getUserByAddress(ADDR_A))!;
    const progress = await retryAccountProvisioning(repo, user.userId, NOW);

    expect(progress.status).toBe("active");
    expect(progress.attempts).toBe(1);
    expect(progress.completedSteps).toEqual([...PROVISIONING_STEPS]);

    const wallet = await repo.getWallet(user.userId);
    expect(wallet).not.toBeNull();

    const activeUser = await repo.getUserByAddress(ADDR_A);
    expect(activeUser?.status).toBe("active");
  });

  it("a failed bootstrap is recoverable: the released claim lets a fresh provisioning converge", async () => {
    // Bootstrap itself fails (user creation is down), compensation releases
    // the username claim, and the address is not bound to any user.
    const first = await provisionAccount(failOnce(repo, "createUser", transient()), INPUT, NOW);
    expect(first.status).toBe("retryable");
    expect(await repo.getUsernameReservation("alice_dev")).toBeNull();
    expect(await repo.getUserByAddress(ADDR_A)).toBeNull();

    // A fresh provisioning attempt can re-claim the username and converge.
    const recovered = await provisionAccount(repo, INPUT, NOW);
    expect(recovered.status).toBe("active");
    expect(await repo.getUserByAddress(ADDR_A)).not.toBeNull();
    expect(await repo.getUsernameReservation("alice_dev")).toBeNull();
  });

  it("rejects retries for active accounts", async () => {
    await provisionAccount(repo, INPUT, NOW);
    const user = (await repo.getUserByAddress(ADDR_A))!;

    await expect(retryAccountProvisioning(repo, user.userId, NOW)).rejects.toMatchObject({
      code: "invalid_state_transition",
    });
  });

  it("rejects retries while a run is in flight (pending)", async () => {
    await provisionAccount(repo, INPUT, NOW);
    const user = (await repo.getUserByAddress(ADDR_A))!;
    const record = (await repo.getProvisioningRecord(user.userId))!;
    await repo.setProvisioningRecord({ ...record, status: "pending" }, record.version);

    await expect(retryAccountProvisioning(repo, user.userId, NOW)).rejects.toMatchObject({
      code: "invalid_state_transition",
    });
  });

  it("returns not_found when no provisioning record exists", async () => {
    await seedUser(repo, buildUser());

    await expect(retryAccountProvisioning(repo, "usr_alice", NOW)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("getProvisioningProgress", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("exposes only safe progress fields, never identifiers or secrets", async () => {
    const progress = await provisionAccount(repo, INPUT, NOW);

    expect(Object.keys(progress).sort()).toEqual(
      [
        "status",
        "requestedUsername",
        "completedSteps",
        "currentStep",
        "attempts",
        "failure",
        "updatedAt",
      ].sort(),
    );
    expect(progress).not.toHaveProperty("userId");
    expect(progress).not.toHaveProperty("email");
    expect(progress).not.toHaveProperty("address");

    const user = (await repo.getUserByAddress(ADDR_A))!;
    expect(await getProvisioningProgress(repo, user.userId)).toEqual(progress);
  });

  it("returns null when no provisioning started", async () => {
    await seedUser(repo, buildUser());
    expect(await getProvisioningProgress(repo, "usr_alice")).toBeNull();
  });
});

describe("username reservation repository contract", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("reserves, idempotently re-claims for the same user, and refuses other users", async () => {
    const first: UsernameReservationResult = await repo.reserveUsername(
      "alice_dev",
      "usr_alice",
      USERNAME_RESERVATION_LEASE_MS,
    );
    expect(first.outcome).toBe("reserved");

    const again: UsernameReservationResult = await repo.reserveUsername(
      "alice_dev",
      "usr_alice",
      USERNAME_RESERVATION_LEASE_MS,
    );
    expect(again.outcome).toBe("already-reserved");

    const other: UsernameReservationResult = await repo.reserveUsername(
      "alice_dev",
      "usr_bob",
      USERNAME_RESERVATION_LEASE_MS,
    );
    expect(other.outcome).toBe("unavailable");

    // A bound user record outranks any claim.
    await seedUser(repo, buildUser({ userId: "usr_bob", address: ADDR_B, username: "bob_dev" }));
    const bound: UsernameReservationResult = await repo.reserveUsername(
      "bob_dev",
      "usr_carol",
      USERNAME_RESERVATION_LEASE_MS,
    );
    expect(bound.outcome).toBe("unavailable");
  });

  it("expired claims are reclaimable and release is owner-gated and idempotent", async () => {
    await repo.reserveUsername("alice_dev", "usr_alice", 1);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const reclaimed: UsernameReservationResult = await repo.reserveUsername(
      "alice_dev",
      "usr_bob",
      USERNAME_RESERVATION_LEASE_MS,
    );
    expect(reclaimed.outcome).toBe("reserved");

    expect(await repo.releaseUsernameReservation("alice_dev", "usr_alice")).toBe(false);
    expect(await repo.releaseUsernameReservation("alice_dev", "usr_bob")).toBe(true);
    expect(await repo.releaseUsernameReservation("alice_dev", "usr_bob")).toBe(false);
  });
});

import {
  betaDefaultMailboxPolicy,
  getMailboxPolicy,
  getPolicyWriteIntent,
} from "../../../src/server/api/policy-service";

const owner = `G${"A".repeat(55)}`;

describe("initializeMailboxPolicyDefaults (BETA-023 / Issue #1930)", () => {
  it("provisions the privacy-safe beta default on first run", async () => {
    const repository = new MemoryApiRepository();

    const result = await initializeMailboxPolicyDefaults(repository, owner);

    expect(result).toMatchObject({
      provisioned: true,
      source: "default",
      offchainVersion: 1,
      scheduled: true,
      policy: betaDefaultMailboxPolicy,
    });

    await expect(getMailboxPolicy(repository, owner)).resolves.toMatchObject({
      policy: {
        allowUnknown: true,
        requireVerified: false,
        minimumPostage: "0",
      },
      source: "configured",
    });
  });

  it("schedules a matching testnet contract write at version 1", async () => {
    const repository = new MemoryApiRepository();

    await initializeMailboxPolicyDefaults(repository, owner);

    const intent = await getPolicyWriteIntent(repository, owner);
    expect(intent).toMatchObject({
      status: "pending",
      offchainVersion: 1,
      policy: betaDefaultMailboxPolicy,
    });
  });

  it("is idempotent: a retry never bumps the version or re-schedules", async () => {
    const repository = new MemoryApiRepository();

    await initializeMailboxPolicyDefaults(repository, owner);
    const second = await initializeMailboxPolicyDefaults(repository, owner);
    const third = await initializeMailboxPolicyDefaults(repository, owner);

    expect(second).toMatchObject({ provisioned: false, scheduled: false });
    expect(third).toMatchObject({ provisioned: false, scheduled: false });

    const intent = await getPolicyWriteIntent(repository, owner);
    expect(intent?.offchainVersion).toBe(1);
  });

  it("never overwrites a user-customized policy", async () => {
    const repository = new MemoryApiRepository();

    const { setMailboxPolicy } = await import("../../../src/server/api/policy-service");
    await setMailboxPolicy(repository, owner, {
      allowUnknown: false,
      requireVerified: true,
      minimumPostage: "250",
    });

    const result = await initializeMailboxPolicyDefaults(repository, owner);

    expect(result).toMatchObject({
      provisioned: false,
      source: "configured",
      scheduled: false,
      offchainVersion: 1,
    });

    await expect(getMailboxPolicy(repository, owner)).resolves.toMatchObject({
      policy: {
        allowUnknown: false,
        requireVerified: true,
        minimumPostage: "250",
      },
    });
  });

  it("reports the beta default as the scheduled policy", async () => {
    const repository = new MemoryApiRepository();

    const result = await initializeMailboxPolicyDefaults(repository, owner);

    expect(result.policy).toEqual(betaDefaultMailboxPolicy);
  });
});
