/**
 * BETA-084 (Issue #1991) — Shared fixtures for account-isolation security tests.
 */

import { hashPassword } from "@/server/api/auth/password";
import type {
  DraftRecord,
  ExternalWallet,
  Profile,
  StoredEnvelope,
  UnknownSenderRequest,
  User,
} from "@/server/api/domain";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import { FakeR2Bucket } from "@/services/storage/r2-fake";
import { R2ObjectStoreAdapter } from "@/services/storage/r2-adapter";
import { createObjectCommitment } from "@/services/storage/object-store";

export const ALICE_ADDRESS = `G${"A".repeat(55)}`;
export const BOB_ADDRESS = `G${"B".repeat(55)}`;
export const CHARLIE_ADDRESS = `G${"C".repeat(55)}`;
export const SENDER_ADDRESS = `G${"D".repeat(55)}`;

export const MESSAGE_ID = "a".repeat(64);
export const MESSAGE_ID_2 = "b".repeat(64);
export const CONTENT_HASH = "c".repeat(64);

/** Populated by seedAliceAttachmentChunk in attachment security tests. */
export let aliceAttachmentContentHash: string = CONTENT_HASH;

export async function seedAliceAttachmentObjectStore(
  repository?: MemoryApiRepository,
): Promise<{ objectStore: R2ObjectStoreAdapter; contentHash: string }> {
  if (repository) {
    (globalThis as { __stealthApiRepository?: MemoryApiRepository }).__stealthApiRepository =
      repository;
  }

  const bucket = new FakeR2Bucket();
  const objectStore = new R2ObjectStoreAdapter(bucket as unknown as R2Bucket);
  (globalThis as { __stealthObjectStore?: R2ObjectStoreAdapter }).__stealthObjectStore =
    objectStore;

  const chunk = new Uint8Array([7, 8, 9, 10]);
  const chunkCommitment = await createObjectCommitment(chunk);
  const contentHash = chunkCommitment.split(":")[3]!;

  const staged = await objectStore.stage({
    kind: "attachment-chunk",
    messageId: MESSAGE_ID,
    ownerAddress: ALICE_ADDRESS,
    contentType: "application/octet-stream",
    contentLength: chunk.length,
    contentCommitment: chunkCommitment,
    bytes: chunk,
    chunkIndex: 0,
    totalChunks: 1,
  });

  await objectStore.finalize({
    stagedKey: staged.stagedKey,
    ownerAddress: ALICE_ADDRESS,
    expectedContentLength: chunk.length,
    expectedCommitment: chunkCommitment,
  });

  aliceAttachmentContentHash = contentHash;
  return { objectStore, contentHash };
}
export const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
export const DRAFT_ID = "draft_alice_001";

const NOW = "2026-08-23T08:00:00.000Z";
const SESSION_EXPIRY = "2026-09-23T08:00:00.000Z";

export interface IsolatedUserFixture {
  user: User;
  profile: Profile;
  sessionId: string;
  password: string;
}

export interface TwoUserIsolationFixture {
  repository: MemoryApiRepository;
  alice: IsolatedUserFixture;
  bob: IsolatedUserFixture;
}

export type SecurityControlOwner =
  | "api-auth"
  | "api-authorization"
  | "session-service"
  | "admin-platform"
  | "signed-request"
  | "object-store";

async function seedUser(
  repository: MemoryApiRepository,
  opts: {
    userId: string;
    address: string;
    email: string;
    username: string;
    displayName: string;
    password: string;
    sessionId: string;
  },
): Promise<IsolatedUserFixture> {
  const { hash, salt } = await hashPassword(opts.password);
  const user: User = {
    userId: opts.userId,
    address: opts.address,
    email: opts.email,
    username: opts.username,
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
  await repository.createUser(user, {
    credentialId: `cred_${opts.userId}`,
    userId: opts.userId,
    authMethod: "password_hash",
    secretHash: `${hash}:${salt}`,
    walletKeyRef: `wallet:managed:${opts.userId}`,
    createdAt: NOW,
    updatedAt: NOW,
  });

  const profile: Profile = {
    userId: opts.userId,
    username: opts.username,
    displayName: opts.displayName,
    locale: "en",
    timezone: "UTC",
    addressDisplay: "truncated",
    createdAt: NOW,
    updatedAt: NOW,
  };
  await repository.setProfile(profile);

  const session = await repository.createSession({
    sessionId: opts.sessionId,
    userId: opts.userId,
    createdAt: NOW,
    lastActiveAt: NOW,
    expiresAt: SESSION_EXPIRY,
  });

  return { user, profile, sessionId: session.sessionId, password: opts.password };
}

export async function seedTwoUserIsolationFixture(): Promise<TwoUserIsolationFixture> {
  const repository = new MemoryApiRepository();
  (globalThis as { __stealthApiRepository?: MemoryApiRepository }).__stealthApiRepository =
    repository;

  const alice = await seedUser(repository, {
    userId: "usr_alice_iso",
    address: ALICE_ADDRESS,
    email: "alice@stealth.mail",
    username: "alice_smith",
    displayName: "Alice Smith",
    password: "Password123!a",
    sessionId: "sess_alice_iso",
  });

  const bob = await seedUser(repository, {
    userId: "usr_bob_iso",
    address: BOB_ADDRESS,
    email: "bob@stealth.mail",
    username: "bob_jones",
    displayName: "Bob Jones",
    password: "Password123!b",
    sessionId: "sess_bob_iso",
  });

  return { repository, alice, bob };
}

export function sessionCookie(sessionId: string): string {
  return `stealth_session=${sessionId}`;
}

export function makeEnvelope(overrides: Partial<StoredEnvelope> = {}): StoredEnvelope {
  return {
    messageId: MESSAGE_ID,
    senderId: SENDER_ADDRESS,
    recipientId: ALICE_ADDRESS,
    ciphertext: "aGVsbG8=",
    protectedHeaders: { alg: "dir", enc: "A256GCM", version: "v1" },
    createdAt: NOW,
    status: "pending",
    ...overrides,
  };
}

export function makeSenderRequest(
  overrides: Partial<UnknownSenderRequest> = {},
): UnknownSenderRequest {
  return {
    requestId: REQUEST_ID,
    recipient: ALICE_ADDRESS,
    sender: SENDER_ADDRESS,
    message: {
      messageId: MESSAGE_ID_2,
      ciphertextHash: CONTENT_HASH,
    },
    expiresAt: "2026-12-31T23:59:59.000Z",
    createdAt: NOW,
    status: "pending",
    ...overrides,
  };
}

export async function seedAliceMailbox(repository: MemoryApiRepository): Promise<void> {
  await repository.insertEnvelope(makeEnvelope());
}

export async function seedAliceContact(repository: MemoryApiRepository): Promise<string> {
  const contactId = "c_alice_test";
  await repository.createContact({
    contactId,
    owner: ALICE_ADDRESS,
    name: "Alice Contact",
    address: CHARLIE_ADDRESS,
    canonicalAddress: CHARLIE_ADDRESS,
    trust: "default",
    source: "manual",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  });
  return contactId;
}

export async function seedAliceComposeDraft(repository: MemoryApiRepository): Promise<void> {
  const draft: DraftRecord = {
    draftId: DRAFT_ID,
    owner: ALICE_ADDRESS,
    encryptedPayload: "c2VjcmV0LWRyYWZ0",
    nonce: "bm9uY2U=",
    tag: "dGFn",
    algorithm: "AES-256-GCM",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
  await repository.createDraft(draft);
}

export async function seedAliceExternalWallet(repository: MemoryApiRepository): Promise<void> {
  const wallet: ExternalWallet = {
    address: CHARLIE_ADDRESS,
    capabilities: ["read", "sign"],
    linkedAt: NOW,
    network: "Test SDF Network ; September 2015",
  };
  await repository.setExternalWallet(ALICE_ADDRESS, wallet);
}

export async function seedAliceSenderRequest(repository: MemoryApiRepository): Promise<void> {
  await repository.createSenderRequestIfAbsent(makeSenderRequest());
}

export async function seedAlicePostage(repository: MemoryApiRepository): Promise<void> {
  await repository.setPostage({
    messageId: MESSAGE_ID,
    recipient: ALICE_ADDRESS,
    sender: SENDER_ADDRESS,
    amount: "100",
    status: "pending",
    paymentHash: "d".repeat(64),
    createdAt: NOW,
  });
}

export function classifyDenial(status: number): "denied" | "leaked" {
  return status === 401 || status === 403 || status === 404 ? "denied" : "leaked";
}
