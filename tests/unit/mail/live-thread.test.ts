import { afterEach, describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

import type { Email } from "@/components/mail/data";
import type { MailboxSealedMessage } from "@/lib/api";
import { createCommitment } from "@/services/crypto/commitment";
import { encodeAad } from "@/services/crypto/aad";
import { canonicalizePayload, type EnvelopePayload } from "@/services/crypto/envelope";
import { ENVELOPE_SIGNATURE_DOMAIN, type EnvelopeSignature } from "@/services/crypto/signature";
import { toHex } from "@/services/crypto/codec";
import {
  applyThreadMessageToEmail,
  buildMailThread,
  canRenderBody,
  isTrustedContent,
  openSealedMailboxMessage,
  siblingMessageIds,
} from "@/features/mail/live-thread";
import { createStaticKeyProvider, registerMailboxKeyProvider } from "@/features/mail/mailbox-keys";
import { isolateRemoteResources, parseSafeContent } from "@/features/mail/safe-rendering";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function buildTestEnvelope(
  body: string,
  key: CryptoKey,
  senderKp: Keypair,
  recipient: string,
  timestamp = "2026-07-23T12:00:00.000Z",
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(body);
  const aad = encodeAad({
    version: "v1",
    sender: senderKp.publicKey(),
    recipient,
    timestamp,
    attachments: [],
  });
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad as BufferSource },
      key,
      plaintext,
    ),
  );
  const tag = ct.slice(ct.length - 16);
  const commitment = await createCommitment(ct);
  const payload: EnvelopePayload = {
    version: "v1",
    sender: senderKp.publicKey(),
    recipient,
    timestamp,
    encryption_metadata: {
      algorithm: "AES-256-GCM",
      nonce: Array.from(iv)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
      mac: Array.from(tag)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
    },
    content_commitment: commitment,
    attachments: [],
  };
  const canonical = canonicalizePayload(payload);
  const dataToSign = Buffer.from(ENVELOPE_SIGNATURE_DOMAIN + canonical);
  const signature: EnvelopeSignature = {
    scheme: "Ed25519",
    signerAddress: senderKp.publicKey(),
    value: toHex(new Uint8Array(senderKp.sign(dataToSign))),
  };
  return {
    payload,
    ciphertext: toBase64(ct),
    signature,
  };
}

function sealedFrom(
  messageId: string,
  input: Awaited<ReturnType<typeof buildTestEnvelope>>,
  subject = "Hello",
): MailboxSealedMessage {
  return {
    messageId,
    senderId: input.payload.sender,
    recipientId: input.payload.recipient,
    status: "delivered",
    createdAt: input.payload.timestamp,
    protectedHeaders: {
      subject,
      from: input.payload.sender,
      threadId: "thread-shared",
    },
    isTombstone: false,
    ciphertext: input.ciphertext,
    payload: input.payload,
    signature: input.signature,
  };
}

function baseEmail(id: string, overrides: Partial<Email> = {}): Email {
  return {
    id,
    from: "Sender",
    email: "sender",
    subject: "Hello",
    preview: "Encrypted payload",
    body: "",
    time: "Now",
    unread: true,
    starred: false,
    folder: "inbox",
    labels: [],
    attachments: [],
    avatarColor: "#5b6470",
    threadId: "thread-shared",
    ...overrides,
  };
}

describe("live thread reader (BETA-055)", () => {
  afterEach(() => {
    registerMailboxKeyProvider(null);
  });

  it("decrypts plaintext through the hardened pipeline and marks it verified", async () => {
    const senderKp = Keypair.random();
    const recipient = Keypair.random().publicKey();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const input = await buildTestEnvelope(
      "Invoice paid.\n\nAmount: 12 XLM",
      key,
      senderKp,
      recipient,
    );
    const sealed = sealedFrom("1".repeat(64), input);
    const message = await openSealedMailboxMessage(
      sealed,
      createStaticKeyProvider(key, recipient),
      recipient,
    );

    expect(message.trust).toBe("verified");
    expect(isTrustedContent(message)).toBe(true);
    expect(canRenderBody(message)).toBe(true);
    expect(message.safeContent?.rawCleanText).toContain("Invoice paid.");
    expect(message.provenance?.senderVerified).toBe(true);
    expect(message.provenance?.digest).toHaveLength(64);
  });

  it("sanitizes HTML and blocks remote resources without rendering them as trusted HTML", async () => {
    const senderKp = Keypair.random();
    const recipient = Keypair.random().publicKey();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const html =
      '<p>Welcome</p><img src="https://tracker.example/pixel.png"><script>alert(1)</script>';
    const input = await buildTestEnvelope(html, key, senderKp, recipient);
    const message = await openSealedMailboxMessage(
      sealedFrom("2".repeat(64), input),
      createStaticKeyProvider(key, recipient),
      recipient,
    );

    expect(message.trust).toBe("verified");
    expect(message.safeContent?.rawCleanText).toContain("Welcome");
    expect(message.safeContent?.rawCleanText).not.toContain("alert(1)");
    expect(message.safeContent?.rawCleanText).not.toContain("tracker.example");
    expect(message.remoteResources.blockedCount).toBeGreaterThan(0);
    expect(message.authenticityWarning).toMatch(/remote resource/i);
  });

  it("quarantines tampered ciphertext and never exposes a trusted body", async () => {
    const senderKp = Keypair.random();
    const recipient = Keypair.random().publicKey();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const input = await buildTestEnvelope("Secret", key, senderKp, recipient);
    const sealed = sealedFrom("3".repeat(64), input);
    sealed.ciphertext = toBase64(new Uint8Array(32).fill(7));
    const message = await openSealedMailboxMessage(
      sealed,
      createStaticKeyProvider(key, recipient),
      recipient,
    );

    expect(canRenderBody(message)).toBe(false);
    expect(isTrustedContent(message)).toBe(false);
    expect(message.trust).toBe("quarantined");
    expect(message.safeContent).toBeUndefined();
    const email = applyThreadMessageToEmail(baseEmail(sealed.messageId), message);
    expect(email.body).toBe("");
    expect(email.verifiedSender).toBe(false);
  });

  it("locks the body when the recipient key is missing", async () => {
    const senderKp = Keypair.random();
    const recipient = Keypair.random().publicKey();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const otherKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const input = await buildTestEnvelope("Still locked", key, senderKp, recipient);
    const message = await openSealedMailboxMessage(
      sealedFrom("4".repeat(64), input),
      createStaticKeyProvider(otherKey, recipient),
      recipient,
    );

    expect(message.trust).toBe("locked");
    expect(canRenderBody(message)).toBe(false);
    expect(message.encryptedPayload.failureReason).toBe("key");
    expect(message.encryptedPayload.status).toBe("failed");
  });

  it("builds a mixed-state thread and only renders the verified message body", async () => {
    const senderKp = Keypair.random();
    const recipient = Keypair.random().publicKey();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const good = sealedFrom(
      "5".repeat(64),
      await buildTestEnvelope("Safe reply", key, senderKp, recipient, "2026-07-23T12:00:00.000Z"),
    );
    const bad = sealedFrom(
      "6".repeat(64),
      await buildTestEnvelope("Tamper me", key, senderKp, recipient, "2026-07-23T12:01:00.000Z"),
    );
    bad.ciphertext = toBase64(new Uint8Array(32).fill(9));

    const thread = await buildMailThread(
      [bad, good],
      createStaticKeyProvider(key, recipient),
      good.messageId,
      recipient,
    );

    expect(thread.mixedState).toBe(true);
    expect(thread.messages).toHaveLength(2);
    const verified = thread.messages.find((item) => item.messageId === good.messageId)!;
    const quarantined = thread.messages.find((item) => item.messageId === bad.messageId)!;
    expect(verified.trust).toBe("verified");
    expect(quarantined.trust).toBe("quarantined");
    expect(canRenderBody(verified)).toBe(true);
    expect(canRenderBody(quarantined)).toBe(false);
  });

  it("groups sibling ids by threadId without exceeding the cap", () => {
    const emails = [
      baseEmail("a", { threadId: "t1" }),
      baseEmail("b", { threadId: "t1" }),
      baseEmail("c", { threadId: "t2" }),
    ];
    expect(siblingMessageIds(emails, "a")).toEqual(["a", "b"]);
    expect(siblingMessageIds(emails, "c")).toEqual(["c"]);
  });
});

describe("remote resource isolation (BETA-055)", () => {
  it("strips tracking pixels and remote media so opening mail cannot fetch them", () => {
    const isolated = isolateRemoteResources(
      '<p>Hi</p><img src="https://ads.example/track.gif"><link href="https://ads.example/x.css">',
    );
    expect(isolated.sanitized).toContain("<p>Hi</p>");
    expect(isolated.sanitized).not.toContain("ads.example");
    expect(isolated.isolation.blockedCount).toBeGreaterThan(0);
    expect(isolated.isolation.blockedUrls.some((url) => url.includes("ads.example"))).toBe(true);
  });

  it("keeps plaintext URLs as text without turning them into network requests", () => {
    const parsed = parseSafeContent("See https://example.com/docs for the spec.");
    expect(parsed.rawCleanText).toContain("https://example.com/docs");
    expect(parsed.remoteResources.blockedCount).toBe(0);
  });
});
