import { describe, expect, it } from "vitest";
import type { Email } from "../../../src/components/mail/data";
import { validateProofQuery } from "../../../src/features/proof-inspector/utils";
import {
  buildMessageEvidence,
  classifyProofEvidence,
  fetchProofEvidence,
  proofVerdict,
  resolveEmailForQuery,
  type ProofEvidence,
  type ProofEvidenceApi,
  type ProofMessageEvidence,
} from "../../../src/features/proof-inspector/evidence";
import { ApiClientError } from "../../../src/lib/api";
import type {
  LifecycleAnchorRecord,
  PolicyReconciliation,
  PostageRecord,
  ReceiptRecord,
} from "../../../src/lib/api";

function makeEmail(overrides: Partial<Email>): Email {
  return {
    id: "1",
    from: "Alice Example",
    email: "alice@example.com",
    subject: "Test subject",
    preview: "A preview",
    body: "Hello world",
    time: "10:00 AM",
    unread: true,
    starred: false,
    folder: "verified",
    avatarColor: "#6d28d9",
    ...overrides,
  };
}

const OWNER = `G${"E".repeat(55)}`;
const SENDER = `G${"B".repeat(55)}`;
const MESSAGE_ID = "a".repeat(64);

const validMessage: ProofMessageEvidence = {
  messageId: MESSAGE_ID,
  subject: "Fixture",
  from: "Alice Example",
  email: SENDER,
  folder: "verified",
  senderRule: "allow",
  postageAmount: "10000000",
  digest: "c".repeat(64),
  contentCommitment: "d".repeat(64),
  timestamp: "2026-06-16T10:00:00.000Z",
  senderVerified: true,
  signatureVerified: true,
  tampered: false,
};

const validPostage: PostageRecord = {
  amount: "10000000",
  createdAt: "2026-06-16T09:00:00.000Z",
  messageId: MESSAGE_ID,
  paymentHash: "b".repeat(64),
  recipient: OWNER,
  sender: SENDER,
  status: "settled",
};

const validReceipt: ReceiptRecord = {
  deliveredAt: "2026-06-16T09:01:00.000Z",
  messageId: MESSAGE_ID,
  readAt: "2026-06-16T09:02:00.000Z",
  recipient: OWNER,
  sender: SENDER,
  txHash: "e".repeat(64),
  chainStatus: "confirmed",
};

const validLifecycle: LifecycleAnchorRecord = {
  messageId: MESSAGE_ID,
  sender: SENDER,
  recipient: OWNER,
  amount: "10000000",
  verified: true,
  receiptRequired: false,
  status: "confirmed",
  scheduledAt: "2026-06-16T08:00:00.000Z",
  updatedAt: "2026-06-16T08:01:00.000Z",
  failureCount: 0,
  lastError: null,
  txHash: "f".repeat(64),
};

const validPolicy: PolicyReconciliation = {
  owner: OWNER,
  state: "synced",
  offchain: {
    policy: { allowUnknown: false, minimumPostage: "0", requireVerified: false },
    source: "configured",
    version: 1,
    intentStatus: "confirmed",
    intentUpdatedAt: "2026-06-16T08:00:00.000Z",
    intentError: null,
  },
  chain: {
    policy: { allowUnknown: false, minimumPostage: "0", requireVerified: false },
    version: 1,
  },
  writeIntent: null,
};

function makeEvidence(
  message: ProofMessageEvidence = validMessage,
  partial: Partial<ProofEvidence> = {},
): ProofEvidence {
  return {
    message,
    postage: validPostage,
    receipt: validReceipt,
    lifecycle: validLifecycle,
    policy: validPolicy,
    fetchedAt: "2026-06-16T12:00:00.000Z",
    ...partial,
  };
}

describe("validateProofQuery", () => {
  it("returns null state for empty query", () => {
    expect(validateProofQuery("")).toEqual({ text: "", type: null });
  });

  it("recognises a valid G-address", () => {
    const addr = `G${"A".repeat(55)}`;
    const result = validateProofQuery(addr);
    expect(result.type).toBe("success");
    expect(result.text).toContain("Stellar address");
  });

  it("recognises a valid C-address", () => {
    const addr = `C${"B".repeat(55)}`;
    const result = validateProofQuery(addr);
    expect(result.type).toBe("success");
  });

  it("recognises a valid 64-char hex hash without prefix", () => {
    const hash = "a".repeat(64);
    const result = validateProofQuery(hash);
    expect(result.type).toBe("success");
    expect(result.text).toContain("hash");
  });

  it("recognises a valid 64-char hex hash with 0x prefix", () => {
    const hash = `0x${"b".repeat(64)}`;
    const result = validateProofQuery(hash);
    expect(result.type).toBe("success");
  });

  it("recognises a valid UUID", () => {
    const uuid = "d1f038c7-4b1d-44a6-8968-3e5f49230501";
    const result = validateProofQuery(uuid);
    expect(result.type).toBe("success");
    expect(result.text).toContain("diagnostic ID");
  });

  it("returns error for short G-address", () => {
    const short = "G" + "A".repeat(20);
    const result = validateProofQuery(short);
    expect(result.type).toBe("error");
    expect(result.text).toContain("Invalid address length");
  });

  it("returns error for short hex hash without prefix", () => {
    const short = "a".repeat(20);
    const result = validateProofQuery(short);
    expect(result.type).toBe("error");
    expect(result.text).toContain("Invalid hash length");
  });

  it("falls back to keyword warning for plain text", () => {
    const result = validateProofQuery("Alice");
    expect(result.type).toBe("warning");
    expect(result.text).toContain("keyword");
  });
});

describe("resolveEmailForQuery", () => {
  const emails: Email[] = [
    makeEmail({ id: "1", from: "Alice Example", email: "alice@example.com" }),
    makeEmail({
      id: "2",
      from: "Bob Smith",
      email: "bob@test.com",
      subject: "Meeting notes",
      provenanceData: {
        sender: "bob@test.com",
        recipient: OWNER,
        timestamp: "2026-06-16T10:00:00.000Z",
        contentCommitment: "d".repeat(64),
        version: "1",
        algorithm: "AES-256-GCM",
        senderVerified: true,
        signatureVerified: true,
        recipientBound: true,
        digest: "c".repeat(64),
      },
    }),
  ];

  it("returns empty array for empty query", () => {
    expect(resolveEmailForQuery(emails, "")).toBeNull();
    expect(resolveEmailForQuery(emails, "   ")).toBeNull();
  });

  it("matches by sender name", () => {
    expect(resolveEmailForQuery(emails, "Alice")?.id).toBe("1");
  });

  it("matches by email address", () => {
    expect(resolveEmailForQuery(emails, "bob@test.com")?.id).toBe("2");
  });

  it("matches by subject", () => {
    expect(resolveEmailForQuery(emails, "Meeting")?.id).toBe("2");
  });

  it("matches by message digest hash", () => {
    expect(resolveEmailForQuery(emails, "c".repeat(64))?.id).toBe("2");
  });

  it("matches by message id", () => {
    expect(resolveEmailForQuery(emails, "1")?.id).toBe("1");
  });

  it("is case-insensitive", () => {
    expect(resolveEmailForQuery(emails, "ALICE")?.id).toBe("1");
  });

  it("returns null when nothing matches", () => {
    expect(resolveEmailForQuery(emails, "zzzzznotfound")).toBeNull();
  });
});

describe("buildMessageEvidence", () => {
  it("builds real message evidence from the email, not fabricated proof", () => {
    const email = makeEmail({
      id: MESSAGE_ID,
      provenanceData: {
        sender: "alice@example.com",
        recipient: OWNER,
        timestamp: "2026-06-16T10:00:00.000Z",
        contentCommitment: "d".repeat(64),
        version: "1",
        algorithm: "AES-256-GCM",
        senderVerified: true,
        signatureVerified: true,
        recipientBound: true,
        digest: "c".repeat(64),
      },
    });
    const message = buildMessageEvidence(email);
    expect(message.messageId).toBe(MESSAGE_ID);
    expect(message.digest).toBe("c".repeat(64));
    expect(message.contentCommitment).toBe("d".repeat(64));
    expect(message.senderVerified).toBe(true);
    expect(message.tampered).toBe(false);
  });

  it("records missing proofs as missing, never fabricated", () => {
    const message = buildMessageEvidence(makeEmail({}));
    expect(message.digest).toBeNull();
    expect(message.contentCommitment).toBeNull();
    expect(message.senderVerified).toBe(false);
  });

  it("marks tampered messages from quarantine evidence", () => {
    const message = buildMessageEvidence(
      makeEmail({
        quarantineRecord: {
          diagnosticId: "quar-0001-0002",
          quarantinedAt: "2026-06-16T10:00:00.000Z",
          reasonCode: "integrity_error",
          userHeadline: "Integrity error",
          userDetail: "Payload failed integrity verification",
          sender: "alice@example.com",
          recipient: OWNER,
        },
      }),
    );
    expect(message.tampered).toBe(true);
  });

  it("marks failed encrypted payloads as tampered", () => {
    const message = buildMessageEvidence(
      makeEmail({
        encryptedPayload: {
          status: "failed",
          diagnosticId: "flt-1e9b-5f62",
          failureReason: "integrity",
        },
      }),
    );
    expect(message.tampered).toBe(true);
  });
});

describe("classifyProofEvidence", () => {
  it("valid fixtures verify every proof", () => {
    const checks = classifyProofEvidence(makeEvidence(), OWNER);
    expect(checks.map((check) => check.state)).toEqual([
      "verified",
      "verified",
      "verified",
      "verified",
      "verified",
      "verified",
      "verified",
    ]);
    expect(proofVerdict(checks)).toMatchObject({ state: "verified", label: "Ledger Verified" });
  });

  it("pending fixtures classify postage, receipt and lifecycle as pending", () => {
    const checks = classifyProofEvidence(
      makeEvidence(validMessage, {
        postage: { ...validPostage, status: "pending" },
        receipt: { ...validReceipt, readAt: null, chainStatus: "pending" },
        lifecycle: { ...validLifecycle, status: "pending", verified: false },
      }),
      OWNER,
    );
    const states = Object.fromEntries(checks.map((check) => [check.key, check.state]));
    expect(states.postage).toBe("pending");
    expect(states.receipt).toBe("pending");
    expect(states.lifecycle).toBe("pending");
    expect(proofVerdict(checks).state).toBe("pending");
  });

  it("missing fixtures show missing proofs and an incomplete verdict", () => {
    const checks = classifyProofEvidence(
      makeEvidence(validMessage, { postage: null, receipt: null, lifecycle: null, policy: null }),
      OWNER,
    );
    const states = Object.fromEntries(checks.map((check) => [check.key, check.state]));
    expect(states.postage).toBe("missing");
    expect(states.receipt).toBe("missing");
    expect(states.lifecycle).toBe("missing");
    expect(states.policy).toBe("missing");
    expect(proofVerdict(checks).state).toBe("incomplete");
  });

  it("conflicting postage recipient produces a visible failed state", () => {
    const otherOwner = `G${"F".repeat(55)}`;
    const checks = classifyProofEvidence(
      makeEvidence(validMessage, { postage: { ...validPostage, recipient: otherOwner } }),
      OWNER,
    );
    expect(checks.find((check) => check.key === "postage")?.state).toBe("mismatched");
    expect(proofVerdict(checks).state).toBe("conflict");
  });

  it("failed lifecycle anchor produces a visible failed state", () => {
    const checks = classifyProofEvidence(
      makeEvidence(validMessage, { lifecycle: { ...validLifecycle, status: "failed" } }),
      OWNER,
    );
    expect(checks.find((check) => check.key === "lifecycle")?.state).toBe("mismatched");
    expect(proofVerdict(checks).state).toBe("conflict");
  });

  it("disputed postage produces a visible failed state", () => {
    const checks = classifyProofEvidence(
      makeEvidence(validMessage, { postage: { ...validPostage, status: "disputed" } }),
      OWNER,
    );
    expect(checks.find((check) => check.key === "postage")?.state).toBe("mismatched");
    expect(proofVerdict(checks).state).toBe("conflict");
  });

  it("tampered fixtures classify message checks as tampered", () => {
    const tamperedMessage: ProofMessageEvidence = { ...validMessage, tampered: true };
    const checks = classifyProofEvidence(makeEvidence(tamperedMessage), OWNER);
    expect(checks.find((check) => check.key === "message-hash")?.state).toBe("tampered");
    expect(checks.find((check) => check.key === "content-commitment")?.state).toBe("tampered");
    expect(checks.find((check) => check.key === "sender-identity")?.state).toBe("tampered");
    expect(proofVerdict(checks).state).toBe("tampered");
  });

  it("policy divergence is classified as mismatched", () => {
    const checks = classifyProofEvidence(
      makeEvidence(validMessage, { policy: { ...validPolicy, state: "diverged" } }),
      OWNER,
    );
    expect(checks.find((check) => check.key === "policy")?.state).toBe("mismatched");
    expect(proofVerdict(checks).state).toBe("conflict");
  });

  it("without owner, participant conflicts are not falsely flagged", () => {
    const checks = classifyProofEvidence(makeEvidence(), null);
    expect(checks.find((check) => check.key === "postage")?.state).toBe("verified");
    expect(proofVerdict(checks).state).toBe("verified");
  });
});

describe("fetchProofEvidence", () => {
  const emails = [makeEmail({ id: MESSAGE_ID, from: "Alice Example" })];

  function fakeApi(overrides: Partial<ProofEvidenceApi> = {}): ProofEvidenceApi {
    return {
      postage: { get: async () => validPostage },
      receipts: { get: async () => validReceipt },
      lifecycle: { get: async () => validLifecycle },
      policies: { getReconciliation: async () => validPolicy },
      ...overrides,
    };
  }

  it("resolves a query to real message + storage + testnet evidence", async () => {
    const result = await fetchProofEvidence({
      query: "Alice",
      emails,
      api: fakeApi(),
      owner: OWNER,
    });
    expect(result.source).toBe("testnet");
    expect(result.evidence?.message?.messageId).toBe(MESSAGE_ID);
    expect(result.evidence?.postage?.paymentHash).toBe("b".repeat(64));
    expect(result.evidence?.receipt?.chainStatus).toBe("confirmed");
    expect(result.evidence?.lifecycle?.status).toBe("confirmed");
    expect(result.evidence?.policy?.state).toBe("synced");
  });

  it("returns null evidence when no message matches", async () => {
    const result = await fetchProofEvidence({
      query: "zzzzzdoesnotexist",
      emails,
      api: fakeApi(),
      owner: OWNER,
    });
    expect(result.evidence).toBeNull();
  });

  it("returns local-only evidence in offline mode with no network calls", async () => {
    let called = false;
    const api = fakeApi({
      postage: {
        get: async () => {
          called = true;
          return validPostage;
        },
      },
    });
    const result = await fetchProofEvidence({
      query: "Alice",
      emails,
      api,
      owner: OWNER,
      offline: true,
    });
    expect(result.source).toBe("local");
    expect(called).toBe(false);
    expect(result.evidence?.postage).toBeNull();
    expect(result.evidence?.message?.messageId).toBe(MESSAGE_ID);
  });

  it("treats 404 testnet records as missing, not errors", async () => {
    const missing = new ApiClientError({
      code: "not_found",
      message: "Postage was not found",
      status: 404,
      retryable: false,
      retryClassification: "none",
    });
    const result = await fetchProofEvidence({
      query: "Alice",
      emails,
      api: fakeApi({
        postage: {
          get: async () => {
            throw missing;
          },
        },
      }),
      owner: OWNER,
    });
    expect(result.evidence?.postage).toBeNull();
    expect(result.evidence?.receipt).not.toBeNull();
  });

  it("propagates transport failures for the UI error state", async () => {
    const offlineError = new ApiClientError({
      code: "dependency_failure",
      message: "You appear to be offline. Check your connection and retry.",
      status: 0,
      retryable: true,
      retryClassification: "transient",
    });
    await expect(
      fetchProofEvidence({
        query: "Alice",
        emails,
        api: fakeApi({
          receipts: {
            get: async () => {
              throw offlineError;
            },
          },
        }),
        owner: OWNER,
      }),
    ).rejects.toBe(offlineError);
  });
});
