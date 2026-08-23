import { describe, expect, it } from "vitest";
import { openDraftContent, sealDraftContent } from "@/server/api/draft-crypto";
import type { DraftContent } from "@/server/api/domain";

describe("draft AEAD encryption at rest (BETA-058 / Issue #1965)", () => {
  const owner = `G${"A".repeat(55)}`;
  const otherOwner = `G${"B".repeat(55)}`;
  const draftId = "d_test_001";

  const sampleContent: DraftContent = {
    to: ["alice@stealth.xyz", "bob@stealth.xyz"],
    cc: ["charlie@stealth.xyz"],
    bcc: [],
    subject: "Confidential Quarterly Report",
    body: "Here are the sensitive numbers for Q3.",
    attachments: [
      {
        filename: "report.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
        contentHash: "a".repeat(64),
      },
    ],
  };

  it("seals and opens draft content faithfully", async () => {
    const sealed = await sealDraftContent(owner, draftId, sampleContent);
    expect(sealed.algorithm).toBe("AES-256-GCM");
    expect(sealed.encryptedPayload).toBeDefined();
    expect(sealed.nonce).toBeDefined();
    expect(sealed.tag).toBeDefined();

    // Plaintext subject/body must NOT appear in raw base64 ciphertext
    expect(sealed.encryptedPayload).not.toContain("Confidential");
    expect(sealed.encryptedPayload).not.toContain("sensitive numbers");

    const opened = await openDraftContent(owner, draftId, sealed);
    expect(opened).toEqual(sampleContent);
  });

  it("fails closed when opening with a different owner (AAD mismatch)", async () => {
    const sealed = await sealDraftContent(owner, draftId, sampleContent);
    await expect(openDraftContent(otherOwner, draftId, sealed)).rejects.toThrow();
  });

  it("fails closed when opening with a different draftId (AAD mismatch)", async () => {
    const sealed = await sealDraftContent(owner, draftId, sampleContent);
    await expect(openDraftContent(owner, "d_other_draft", sealed)).rejects.toThrow();
  });

  it("fails closed when ciphertext or tag is tampered", async () => {
    const sealed = await sealDraftContent(owner, draftId, sampleContent);
    const tampered = {
      ...sealed,
      encryptedPayload: sealed.encryptedPayload.slice(0, -4) + "AAAA",
    };
    await expect(openDraftContent(owner, draftId, tampered)).rejects.toThrow();
  });

  it("generates unique nonces and ciphertexts across repeated encryptions", async () => {
    const first = await sealDraftContent(owner, draftId, sampleContent);
    const second = await sealDraftContent(owner, draftId, sampleContent);

    expect(first.nonce).not.toBe(second.nonce);
    expect(first.encryptedPayload).not.toBe(second.encryptedPayload);
  });
});
