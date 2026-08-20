import { beforeEach, describe, expect, it } from "vitest";

import type { User } from "@/server/api/domain";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import {
  completeOnboarding,
  getOnboardingDraft,
  onboardingCompleteSchema,
  onboardingDraftFieldsSchema,
  onboardingDraftSaveSchema,
  onboardingStepSchema,
  resolveSessionUser,
  saveOnboardingDraft,
  toOnboardingProjection,
  type OnboardingDraftFields,
  type OnboardingStep,
} from "@/server/api/onboarding-service";
import { ApiError } from "@/server/api/errors";

const OWNER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async function createActiveUser(
  repository: MemoryApiRepository,
  userId = "user_onboard_1",
): Promise<User> {
  return repository.createUser({
    userId,
    address: OWNER,
    username: "onboardee",
    email: "onboardee@stealth.mail",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  });
}

function draftInput(
  step: OnboardingStep = "postage",
  draftOverrides: Partial<OnboardingDraftFields> = {},
): { step: OnboardingStep; draft: OnboardingDraftFields } {
  return {
    step,
    draft: {
      displayName: "Ada Lovelace",
      recoveryAcknowledged: true,
      unknownSenderRule: "request",
      minimumPostage: "0.001",
      receiptOnDelivery: false,
      ...draftOverrides,
    },
  };
}

describe("onboarding step schema", () => {
  it("enumerates the profile-first step order", () => {
    expect(onboardingStepSchema.options).toEqual([
      "profile",
      "stealth-address",
      "recovery",
      "sender-policy",
      "postage",
      "receipts",
      "review",
    ]);
  });

  it("rejects the legacy wallet-first step names", () => {
    expect(onboardingStepSchema.safeParse("identity").success).toBe(false);
    expect(onboardingStepSchema.safeParse("policy-review").success).toBe(false);
  });
});

describe("onboarding draft schemas (strict)", () => {
  it("rejects a client-supplied walletAddress with 422 semantics", () => {
    const parsed = onboardingDraftFieldsSchema.safeParse({
      displayName: "Ada",
      recoveryAcknowledged: true,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      walletAddress: `G${"A".repeat(55)}`,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty or overlong display name", () => {
    expect(
      onboardingDraftFieldsSchema.safeParse({
        ...draftInput().draft,
        displayName: "   ",
      }).success,
    ).toBe(false);
    expect(
      onboardingDraftFieldsSchema.safeParse({
        ...draftInput().draft,
        displayName: "x".repeat(81),
      }).success,
    ).toBe(false);
  });

  it("rejects malformed minimum postage amounts", () => {
    expect(
      onboardingDraftFieldsSchema.safeParse({ ...draftInput().draft, minimumPostage: "-1" })
        .success,
    ).toBe(false);
    expect(
      onboardingDraftFieldsSchema.safeParse({ ...draftInput().draft, minimumPostage: "1.23456789" })
        .success,
    ).toBe(false);
  });

  it("accepts a valid draft and save request", () => {
    expect(onboardingDraftFieldsSchema.safeParse(draftInput().draft).success).toBe(true);
    expect(onboardingDraftSaveSchema.safeParse(draftInput()).success).toBe(true);
    expect(onboardingCompleteSchema.safeParse({ draft: draftInput().draft }).success).toBe(true);
  });
});

describe("toOnboardingProjection", () => {
  it("never exposes userId or version", () => {
    const projection = toOnboardingProjection({
      userId: "secret-user",
      status: "in_progress",
      step: "profile",
      displayName: "Ada",
      recoveryAcknowledged: false,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
      version: 7,
    });
    expect(projection).not.toHaveProperty("userId");
    expect(projection).not.toHaveProperty("version");
    expect(projection).toMatchObject({
      status: "in_progress",
      step: "profile",
      displayName: "Ada",
      recoveryAcknowledged: false,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    });
  });
});

describe("resolveSessionUser", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    repository = new MemoryApiRepository();
  });

  it("throws 401 without a session cookie", async () => {
    await expect(resolveSessionUser(repository, null)).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
    await expect(resolveSessionUser(repository, "not-a-cookie")).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
  });

  it("throws 401 for an unknown session", async () => {
    await expect(
      resolveSessionUser(repository, "stealth_session=missing_session"),
    ).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  });

  it("throws 401 when the session's user record is gone", async () => {
    const session = await repository.createSession({
      sessionId: "sess_orphan",
      userId: "ghost_user",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    await expect(
      resolveSessionUser(repository, `stealth_session=${session.sessionId}`),
    ).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  });

  it("resolves the user record from a valid session cookie", async () => {
    const user = await createActiveUser(repository);
    const session = await repository.createSession({
      sessionId: "sess_valid",
      userId: user.userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    await expect(
      resolveSessionUser(repository, `stealth_session=${session.sessionId}`),
    ).resolves.toMatchObject({ userId: user.userId });
  });
});

describe("getOnboardingDraft", () => {
  it("returns null when no draft exists", async () => {
    const repository = new MemoryApiRepository();
    await expect(getOnboardingDraft(repository, "nobody")).resolves.toBeNull();
  });

  it("returns the projection when a draft exists", async () => {
    const repository = new MemoryApiRepository();
    await repository.saveOnboardingDraft({
      userId: "someone",
      status: "in_progress",
      step: "profile",
      displayName: "Ada",
      recoveryAcknowledged: false,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
      version: 0,
    });
    await expect(getOnboardingDraft(repository, "someone")).resolves.toMatchObject({
      step: "profile",
      displayName: "Ada",
    });
  });
});

describe("saveOnboardingDraft", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    repository = new MemoryApiRepository();
  });

  it("creates a new in-progress record on first save", async () => {
    const saved = await saveOnboardingDraft(
      repository,
      "user_x",
      draftInput(),
      new Date(1_700_000_000_000),
    );
    expect(saved).toMatchObject({
      status: "in_progress",
      step: "postage",
      displayName: "Ada Lovelace",
      recoveryAcknowledged: true,
      unknownSenderRule: "request",
      minimumPostage: "0.001",
      receiptOnDelivery: false,
      completedAt: null,
    });
    expect(saved.updatedAt).toBe("2023-11-14T22:13:20.000Z");

    const stored = await repository.getOnboardingDraft("user_x");
    expect(stored?.version).toBe(1);
  });

  it("is keyed by userId and does not duplicate records", async () => {
    await saveOnboardingDraft(repository, "user_x", draftInput("profile"));
    await saveOnboardingDraft(repository, "user_x", draftInput("postage"));
    await saveOnboardingDraft(repository, "user_x", draftInput("review"));
    await saveOnboardingDraft(repository, "user_y", draftInput("profile"));

    const x = await repository.getOnboardingDraft("user_x");
    const y = await repository.getOnboardingDraft("user_y");
    expect(x?.step).toBe("review");
    expect(x?.version).toBe(3);
    expect(y?.step).toBe("profile");
    expect(y?.version).toBe(1);
  });

  it("bumps the version on each save", async () => {
    await saveOnboardingDraft(repository, "user_x", draftInput("profile"));
    await saveOnboardingDraft(repository, "user_x", draftInput("recovery"));
    const stored = await repository.getOnboardingDraft("user_x");
    expect(stored?.version).toBe(2);
  });

  it("throws 409 when onboarding is already complete", async () => {
    await repository.saveOnboardingDraft({
      userId: "user_x",
      status: "completed",
      step: "review",
      displayName: "Ada",
      recoveryAcknowledged: true,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    });
    await expect(saveOnboardingDraft(repository, "user_x", draftInput())).rejects.toMatchObject({
      status: 409,
      code: "invalid_state_transition",
    });
  });
});

describe("completeOnboarding", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    repository = new MemoryApiRepository();
  });

  it("throws 409 for a non-active account", async () => {
    const pending = await repository.createUser({
      userId: "user_pending",
      address: OWNER,
      username: "pending",
      email: "pending@stealth.mail",
      status: "pending_verification",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });
    await expect(completeOnboarding(repository, pending, draftInput().draft)).rejects.toMatchObject(
      { status: 409, code: "invalid_state_transition" },
    );
  });

  it("writes the converted policy when the mailbox still holds the provisioning default", async () => {
    const user = await createActiveUser(repository);
    const result = await completeOnboarding(
      repository,
      user,
      {
        displayName: "Ada",
        recoveryAcknowledged: true,
        unknownSenderRule: "verified",
        minimumPostage: "0.01",
        receiptOnDelivery: true,
      },
      new Date(1_700_000_000_000),
    );

    expect(result.alreadyCompleted).toBe(false);
    expect(result.policy).toEqual({
      allowUnknown: true,
      requireVerified: true,
      minimumPostage: "100000",
      requireReceipt: true,
    });
    expect(result.draft).toMatchObject({
      status: "completed",
      completedAt: "2023-11-14T22:13:20.000Z",
    });

    const stored = await repository.getPolicy(OWNER);
    expect(stored).toMatchObject({
      allowUnknown: true,
      requireVerified: true,
      minimumPostage: "100000",
    });
  });

  it("never clobbers a policy configured after provisioning", async () => {
    await repository.setPolicy(OWNER, {
      allowUnknown: false,
      requireVerified: false,
      minimumPostage: "500",
    });
    const user = await createActiveUser(repository);
    const result = await completeOnboarding(repository, user, draftInput().draft);

    expect(result.alreadyCompleted).toBe(false);
    const stored = await repository.getPolicy(OWNER);
    expect(stored).toEqual({
      allowUnknown: false,
      requireVerified: false,
      minimumPostage: "500",
    });
  });

  it("replays a completed onboarding without rewriting anything", async () => {
    await repository.saveOnboardingDraft({
      userId: "user_onboard_1",
      status: "completed",
      step: "review",
      displayName: "Grace",
      recoveryAcknowledged: true,
      unknownSenderRule: "block",
      minimumPostage: "0.5",
      receiptOnDelivery: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:00.000Z",
      version: 2,
    });
    const user = await createActiveUser(repository, "user_onboard_1");

    const result = await completeOnboarding(repository, user, draftInput().draft);

    expect(result.alreadyCompleted).toBe(true);
    expect(result.draft).toMatchObject({ status: "completed", displayName: "Grace" });
    expect(result.policy).toEqual({
      allowUnknown: false,
      requireVerified: false,
      minimumPostage: "5000000",
      requireReceipt: true,
    });

    const stored = await repository.getPolicy(OWNER);
    expect(stored).toBeNull();
    const draft = await repository.getOnboardingDraft("user_onboard_1");
    expect(draft?.version).toBe(2);
  });
});
