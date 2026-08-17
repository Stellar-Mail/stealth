import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IdempotencyRecord,
  MailboxPolicy,
  Postage,
  PostageStatus,
  Receipt,
  SenderRule,
  StoredEnvelope,
} from "../../../src/server/api/domain";
import type {
  AcquireIdempotencyResult,
  ApiRepository,
  InsertEnvelopeResult,
  PostageTransitionResult,
} from "../../../src/server/api/repository";
import {
  RetryableApiRepository,
  DEFAULT_RETRY_POLICY,
  type RetryPolicy,
} from "../../../src/server/api/repository";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { ApiError, RetryExhaustedError } from "../../../src/server/api/errors";

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const messageId = "a".repeat(64);

class FailingRepository implements ApiRepository {
  public readonly inner = new MemoryApiRepository();
  private readonly failCounts = new Map<string, number>();
  private readonly callCounts = new Map<string, number>();

  setFailCount(method: string, count: number) {
    this.failCounts.set(method, count);
  }

  getCallCount(method: string): number {
    return this.callCounts.get(method) ?? 0;
  }

  private recordCall(method: string): void {
    this.callCounts.set(method, (this.callCounts.get(method) ?? 0) + 1);
  }

  private maybeFail(method: string): void {
    this.recordCall(method);
    const remaining = this.failCounts.get(method) ?? 0;
    if (remaining > 0) {
      this.failCounts.set(method, remaining - 1);
      throw new ApiError(500, "internal_error", "simulated transient failure");
    }
  }

  async getPolicy(owner: string): Promise<MailboxPolicy | null> {
    this.maybeFail("getPolicy");
    return this.inner.getPolicy(owner);
  }
  async setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy> {
    this.maybeFail("setPolicy");
    return this.inner.setPolicy(owner, policy);
  }
  async getPolicyWriteIntent(owner: string) {
    this.maybeFail("getPolicyWriteIntent");
    return this.inner.getPolicyWriteIntent(owner);
  }
  async setPolicyWriteIntent(intent: import("../../../src/server/api/domain").PolicyWriteIntent) {
    this.maybeFail("setPolicyWriteIntent");
    return this.inner.setPolicyWriteIntent(intent);
  }
  async getSenderRule(owner: string, sender: string): Promise<SenderRule> {
    this.maybeFail("getSenderRule");
    return this.inner.getSenderRule(owner, sender);
  }
  async setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule> {
    this.maybeFail("setSenderRule");
    return this.inner.setSenderRule(owner, sender, rule);
  }
  async getPostage(messageId: string): Promise<Postage | null> {
    this.maybeFail("getPostage");
    return this.inner.getPostage(messageId);
  }
  async setPostage(postage: Postage): Promise<Postage> {
    this.maybeFail("setPostage");
    return this.inner.setPostage(postage);
  }
  async transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult> {
    this.maybeFail("transitionPostage");
    return this.inner.transitionPostage(messageId, expectedStatus, nextStatus);
  }
  async insertPostage(postage: Postage): Promise<Postage> {
    this.maybeFail("insertPostage");
    return this.inner.insertPostage(postage);
  }
  async getReceipt(messageId: string): Promise<Receipt | null> {
    this.maybeFail("getReceipt");
    return this.inner.getReceipt(messageId);
  }
  async setReceipt(receipt: Receipt): Promise<Receipt> {
    this.maybeFail("setReceipt");
    return this.inner.setReceipt(receipt);
  }
  async acquireIdempotencyRecord(
    key: string,
    requestDigest: string,
    leaseMs: number,
  ): Promise<AcquireIdempotencyResult> {
    this.maybeFail("acquireIdempotencyRecord");
    return this.inner.acquireIdempotencyRecord(key, requestDigest, leaseMs);
  }
  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    this.maybeFail("getIdempotencyRecord");
    return this.inner.getIdempotencyRecord(key);
  }
  async setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    this.maybeFail("setIdempotencyRecord");
    return this.inner.setIdempotencyRecord(key, record);
  }
  async getRelayQueueDepth(_relayId: string): Promise<number> {
    this.maybeFail("getRelayQueueDepth");
    return this.inner.getRelayQueueDepth(_relayId);
  }
  async getRelayRetryCount(_relayId: string): Promise<number> {
    this.maybeFail("getRelayRetryCount");
    return this.inner.getRelayRetryCount(_relayId);
  }
  async getRelayLastSuccessfulDelivery(_relayId: string): Promise<string | null> {
    this.maybeFail("getRelayLastSuccessfulDelivery");
    return this.inner.getRelayLastSuccessfulDelivery(_relayId);
  }
  async getRelayLastFailedDelivery(_relayId: string): Promise<string | null> {
    this.maybeFail("getRelayLastFailedDelivery");
    return this.inner.getRelayLastFailedDelivery(_relayId);
  }
  async getRelayDeadLetterCount(_relayId: string): Promise<number> {
    this.maybeFail("getRelayDeadLetterCount");
    return this.inner.getRelayDeadLetterCount(_relayId);
  }
  async getCounter(key: string): Promise<number> {
    this.maybeFail("getCounter");
    return this.inner.getCounter(key);
  }
  async incrementCounter(key: string, windowSeconds: number, amount?: number): Promise<number> {
    this.maybeFail("incrementCounter");
    return this.inner.incrementCounter(key, windowSeconds, amount);
  }
  async createReceiptIfAbsent(receipt: Receipt) {
    this.maybeFail("createReceiptIfAbsent");
    return this.inner.createReceiptIfAbsent(receipt);
  }
  async markReceiptRead(messageId: string, actor: string, now?: Date) {
    this.maybeFail("markReceiptRead");
    return this.inner.markReceiptRead(messageId, actor, now);
  }
  async getUserById(userId: string) {
    this.maybeFail("getUserById");
    return this.inner.getUserById(userId);
  }
  async getUserByEmail(email: string) {
    this.maybeFail("getUserByEmail");
    return this.inner.getUserByEmail(email);
  }
  async getUserByUsername(username: string) {
    this.maybeFail("getUserByUsername");
    return this.inner.getUserByUsername(username);
  }
  async getUserByAddress(address: string) {
    this.maybeFail("getUserByAddress");
    return this.inner.getUserByAddress(address);
  }
  async createUser(
    user: import("../../../src/server/api/domain").User,
    credential?: import("../../../src/server/api/domain").Credential,
    profile?: import("../../../src/server/api/domain").Profile,
  ) {
    this.maybeFail("createUser");
    return this.inner.createUser(user, credential, profile);
  }
  async updateUser(user: import("../../../src/server/api/domain").User, expectedVersion: number) {
    this.maybeFail("updateUser");
    return this.inner.updateUser(user, expectedVersion);
  }
  async getProfile(userId: string) {
    this.maybeFail("getProfile");
    return this.inner.getProfile(userId);
  }
  async setProfile(profile: import("../../../src/server/api/domain").Profile) {
    this.maybeFail("setProfile");
    return this.inner.setProfile(profile);
  }
  async getCredential(userId: string) {
    this.maybeFail("getCredential");
    return this.inner.getCredential(userId);
  }
  async setCredential(credential: import("../../../src/server/api/domain").Credential) {
    this.maybeFail("setCredential");
    return this.inner.setCredential(credential);
  }
  async getSession(sessionId: string) {
    this.maybeFail("getSession");
    return this.inner.getSession(sessionId);
  }
  async createSession(session: import("../../../src/server/api/domain").Session) {
    this.maybeFail("createSession");
    return this.inner.createSession(session);
  }
  async updateSession(session: import("../../../src/server/api/domain").Session) {
    this.maybeFail("updateSession");
    return this.inner.updateSession(session);
  }
  async deleteSession(sessionId: string) {
    this.maybeFail("deleteSession");
    return this.inner.deleteSession(sessionId);
  }
  async deleteUserSessions(userId: string) {
    this.maybeFail("deleteUserSessions");
    return this.inner.deleteUserSessions(userId);
  }
  async getRetiredSession(sessionId: string) {
    this.maybeFail("getRetiredSession");
    return this.inner.getRetiredSession(sessionId);
  }
  async createRetiredSession(
    retiredSession: import("../../../src/server/api/domain").RetiredSession,
  ) {
    this.maybeFail("createRetiredSession");
    return this.inner.createRetiredSession(retiredSession);
  }
  async getEnvelope(messageId: string) {
    this.maybeFail("getEnvelope");
    return this.inner.getEnvelope(messageId);
  }
  async insertEnvelope(envelope: import("../../../src/server/api/domain").StoredEnvelope) {
    this.maybeFail("insertEnvelope");
    return this.inner.insertEnvelope(envelope);
  }
  async getVerificationToken(tokenHash: string) {
    this.maybeFail("getVerificationToken");
    return this.inner.getVerificationToken(tokenHash);
  }
  async getActiveVerificationToken(userId: string, purpose: "email_verification") {
    this.maybeFail("getActiveVerificationToken");
    return this.inner.getActiveVerificationToken(userId, purpose);
  }
  async issueVerificationToken(
    token: import("../../../src/server/api/domain").VerificationToken,
    now: Date,
  ) {
    this.maybeFail("issueVerificationToken");
    return this.inner.issueVerificationToken(token, now);
  }
  async consumeVerificationToken(tokenHash: string, now: Date) {
    this.maybeFail("consumeVerificationToken");
    return this.inner.consumeVerificationToken(tokenHash, now);
  }
  async recordVerificationAttempt(tokenHash: string, now: Date) {
    this.maybeFail("recordVerificationAttempt");
    return this.inner.recordVerificationAttempt(tokenHash, now);
  }
  async getExternalWallets(owner: string) {
    this.maybeFail("getExternalWallets");
    return this.inner.getExternalWallets(owner);
  }
  async setExternalWallet(
    owner: string,
    wallet: import("../../../src/server/api/domain").ExternalWallet,
  ) {
    this.maybeFail("setExternalWallet");
    return this.inner.setExternalWallet(owner, wallet);
  }
  async removeExternalWallet(owner: string, address: string) {
    this.maybeFail("removeExternalWallet");
    return this.inner.removeExternalWallet(owner, address);
  }
  async findExternalWalletOwner(address: string) {
    this.maybeFail("findExternalWalletOwner");
    return this.inner.findExternalWalletOwner(address);
  }
  async getWalletChallenge(owner: string, address: string) {
    this.maybeFail("getWalletChallenge");
    return this.inner.getWalletChallenge(owner, address);
  }
  async setWalletChallenge(
    owner: string,
    address: string,
    challenge: import("../../../src/server/api/domain").ExternalWalletChallenge,
  ) {
    this.maybeFail("setWalletChallenge");
    return this.inner.setWalletChallenge(owner, address, challenge);
  }
  async deleteWalletChallenge(owner: string, address: string) {
    this.maybeFail("deleteWalletChallenge");
    return this.inner.deleteWalletChallenge(owner, address);
  }
  async getKeyDirectory(owner: string) {
    this.maybeFail("getKeyDirectory");
    return this.inner.getKeyDirectory(owner);
  }
  async getPublishedKey(owner: string, keyId: string) {
    this.maybeFail("getPublishedKey");
    return this.inner.getPublishedKey(owner, keyId);
  }
  async savePublishedKey(
    owner: string,
    key: import("../../../src/server/api/domain").PublishedKey,
  ) {
    this.maybeFail("savePublishedKey");
    return this.inner.savePublishedKey(owner, key);
  }
  async saveKeyDirectory(record: import("../../../src/server/api/domain").KeyDirectoryRecord) {
    this.maybeFail("saveKeyDirectory");
    return this.inner.saveKeyDirectory(record);
  }
  async listRecipientEnvelopes(
    recipient: string,
    options?: import("../../../src/server/api/repository").MailboxQueryOptions,
  ) {
    this.maybeFail("listRecipientEnvelopes");
    return this.inner.listRecipientEnvelopes(recipient, options);
  }
  async tombstoneEnvelope(messageId: string, recipient: string) {
    this.maybeFail("tombstoneEnvelope");
    return this.inner.tombstoneEnvelope(messageId, recipient);
  }
  async updateEnvelopeStatus(
    messageId: string,
    status: import("../../../src/server/api/domain").MailboxItemStatus,
  ) {
    this.maybeFail("updateEnvelopeStatus");
    return this.inner.updateEnvelopeStatus(messageId, status);
  }
  reset(): void {
    this.inner.reset();
  }
}

describe("RetryableApiRepository", () => {
  let failing: FailingRepository;
  let repo: RetryableApiRepository;

  beforeEach(() => {
    failing = new FailingRepository();
    repo = new RetryableApiRepository(failing, { maxAttempts: 3, baseDelayMs: 1 });
  });

  it("retries a safe read operation on transient failure", async () => {
    failing.setFailCount("getPostage", 1);
    await failing.inner.setPostage({
      messageId,
      amount: "100",
      createdAt: new Date().toISOString(),
      status: "pending",
    } as any);

    const result = await repo.getPostage(messageId);

    expect(result).not.toBeNull();
    expect(result?.messageId).toBe(messageId);
    expect(failing.getCallCount("getPostage")).toBe(2);
  });

  it("retries a safe write operation on transient failure", async () => {
    failing.setFailCount("setPostage", 2);

    const postage = {
      messageId,
      amount: "100",
      createdAt: new Date().toISOString(),
      status: "pending",
    } as any;
    const result = await repo.setPostage(postage);

    expect(result.messageId).toBe(messageId);
    expect(failing.getCallCount("setPostage")).toBe(3);
  });

  it("retries transitionPostage (CAS) on transient failure", async () => {
    failing.setFailCount("transitionPostage", 1);
    const postage = {
      messageId,
      amount: "100",
      createdAt: new Date().toISOString(),
      status: "pending",
    } as any;
    await failing.inner.setPostage(postage);

    const result = await repo.transitionPostage(messageId, "pending", "settled");

    expect(result.outcome).toBe("applied");
    expect(failing.getCallCount("transitionPostage")).toBe(2);
  });

  it("returns RetryExhaustedError when retries are exhausted for a safe operation", async () => {
    failing.setFailCount("getPolicy", 5);

    await expect(repo.getPolicy(owner)).rejects.toThrow(RetryExhaustedError);
    expect(failing.getCallCount("getPolicy")).toBe(3);
  });

  it("RetryExhaustedError wraps the original error", async () => {
    failing.setFailCount("getPostage", 5);

    try {
      await repo.getPostage(messageId);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RetryExhaustedError);
      expect(error).not.toBeInstanceOf(ApiError);
      expect((error as RetryExhaustedError).originalError).toBeInstanceOf(ApiError);
      expect((error as RetryExhaustedError).code).toBe("retry_exhausted");
      expect((error as RetryExhaustedError).status).toBe(500);
    }
  });

  it("does not retry when the error is non-retryable (permanent)", async () => {
    const permanentFailRepo = new MemoryApiRepository();
    permanentFailRepo.getPolicy = async () => {
      throw new ApiError(404, "not_found", "not found");
    };

    const nonRetryRepo = new RetryableApiRepository(permanentFailRepo, {
      maxAttempts: 3,
      baseDelayMs: 1,
    });

    await expect(nonRetryRepo.getPolicy(owner)).rejects.toThrow("not found");
  });

  it("does not retry insertPostage (unsafe write)", async () => {
    failing.setFailCount("insertPostage", 2);

    const postage = {
      messageId,
      amount: "100",
      createdAt: new Date().toISOString(),
      status: "pending",
    } as any;

    await expect(repo.insertPostage(postage)).rejects.toThrow();
    expect(failing.getCallCount("insertPostage")).toBe(1);
  });

  it("does not retry acquireIdempotencyRecord (unsafe write)", async () => {
    failing.setFailCount("acquireIdempotencyRecord", 2);

    await expect(repo.acquireIdempotencyRecord("key", "digest", 30_000)).rejects.toThrow();
    expect(failing.getCallCount("acquireIdempotencyRecord")).toBe(1);
  });

  it("does not retry incrementCounter (unsafe write)", async () => {
    failing.setFailCount("incrementCounter", 2);

    await expect(repo.incrementCounter("key", 60)).rejects.toThrow();
    expect(failing.getCallCount("incrementCounter")).toBe(1);
  });

  it("does not duplicate unsafe write side effects on failure", async () => {
    let insertCount = 0;
    const trackingRepo = new MemoryApiRepository();
    trackingRepo.insertPostage = async (postage: Postage) => {
      insertCount++;
      throw new ApiError(500, "internal_error", "transient");
    };

    const retryRepo = new RetryableApiRepository(trackingRepo, {
      maxAttempts: 3,
      baseDelayMs: 1,
    });

    const postage = {
      messageId,
      amount: "100",
      createdAt: new Date().toISOString(),
      status: "pending",
    } as any;

    await expect(retryRepo.insertPostage(postage)).rejects.toThrow();
    expect(insertCount).toBe(1);
  });

  it("uses default retry policy when none is provided", async () => {
    const defaultRepo = new RetryableApiRepository(failing);

    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(3);
    expect(DEFAULT_RETRY_POLICY.baseDelayMs).toBe(200);
  });

  it("respects configurable max attempts", async () => {
    const customRepo = new RetryableApiRepository(failing, {
      maxAttempts: 5,
      baseDelayMs: 1,
    });
    failing.setFailCount("getReceipt", 4);

    await customRepo.getReceipt(messageId);

    expect(failing.getCallCount("getReceipt")).toBe(5);
  });

  it("respects configurable baseDelayMs via timing", async () => {
    const start = Date.now();
    const slowRepo = new RetryableApiRepository(failing, {
      maxAttempts: 3,
      baseDelayMs: 50,
    });
    failing.setFailCount("getPostage", 2);

    await slowRepo.getPostage(messageId);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  it("retries setSenderRule and setReceipt (idempotent writes)", async () => {
    failing.setFailCount("setSenderRule", 1);
    failing.setFailCount("setReceipt", 1);

    const result = await repo.setSenderRule(owner, sender, "allow");
    expect(result).toBe("allow");
    expect(failing.getCallCount("setSenderRule")).toBe(2);

    const receipt: Receipt = {
      messageId,
      sender,
      recipient: owner,
      deliveredAt: new Date().toISOString(),
      readAt: null,
    };
    const receiptResult = await repo.setReceipt(receipt);
    expect(receiptResult.messageId).toBe(messageId);
    expect(failing.getCallCount("setReceipt")).toBe(2);
  });

  it("delegates reset to the inner repository", async () => {
    const memory = new MemoryApiRepository();
    const retryRepo = new RetryableApiRepository(memory, { maxAttempts: 2, baseDelayMs: 1 });

    await memory.setPolicy(owner, {
      allowUnknown: false,
      minimumPostage: "0",
      requireVerified: true,
    });
    expect(await memory.getPolicy(owner)).not.toBeNull();

    retryRepo.reset();
    expect(await memory.getPolicy(owner)).toBeNull();
  });

  it("retries getEnvelope (safe read) on transient failure", async () => {
    failing.setFailCount("getEnvelope", 1);
    const envelope: StoredEnvelope = {
      messageId,
      senderId: sender,
      recipientId: owner,
      ciphertext: "dGVzdA==",
      protectedHeaders: {
        algorithm: "AES-256-GCM",
        ephemeral_public_key: `G${"C".repeat(55)}`,
        nonce: "ab12cd34ef56",
        mac: "d".repeat(64),
        version: "v1",
      },
      contentCommitment: "c".repeat(64),
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    await failing.inner.insertEnvelope(envelope);

    const result = await repo.getEnvelope(messageId);
    expect(result).not.toBeNull();
    expect(result?.messageId).toBe(messageId);
    expect(failing.getCallCount("getEnvelope")).toBe(2);
  });

  it("does not retry insertEnvelope (unsafe write)", async () => {
    failing.setFailCount("insertEnvelope", 2);
    const envelope: StoredEnvelope = {
      messageId,
      senderId: sender,
      recipientId: owner,
      ciphertext: "dGVzdA==",
      protectedHeaders: {
        algorithm: "AES-256-GCM",
        ephemeral_public_key: `G${"C".repeat(55)}`,
        nonce: "ab12cd34ef56",
        mac: "d".repeat(64),
        version: "v1",
      },
      contentCommitment: "c".repeat(64),
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    await expect(repo.insertEnvelope(envelope)).rejects.toThrow();
    expect(failing.getCallCount("insertEnvelope")).toBe(1);
  });
});
