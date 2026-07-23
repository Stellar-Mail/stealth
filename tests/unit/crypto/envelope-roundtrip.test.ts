import { describe, expect, it } from "vitest";
import { sealEnvelope, canonicalizePayload } from "../../../src/services/crypto/envelope";
import { openEnvelope, type KeyProvider } from "../../../src/services/crypto/open-envelope";
import { canonicalizeJcs } from "../../../src/services/crypto/jcs";
import { createCommitment } from "../../../src/services/crypto/commitment";

function keyProviderFor(key: CryptoKey, recipient = "GABC"): KeyProvider {
  return {
    resolveKey: async (r) => {
      if (r !== recipient) throw new Error("no key");
      return key;
    },
  };
}

/** Utility to convert a string into an array of its exact Unicode code points. */
function toCodePoints(str: string): number[] {
  return Array.from(str).map((c) => c.codePointAt(0)!);
}

describe("Crypto Envelope Round-Trip - Unicode & Binary Edge Cases (#1722)", () => {
  describe("Exact Code Point Preservation", () => {
    const testCases: Array<{ name: string; text: string }> = [
      {
        name: "Multilingual scripts (Japanese, Arabic, Devanagari, Cyrillic, Hebrew, Chinese, Greek)",
        text: "日本語, العربية, हिन्दी, Русский, עברית, 中文繁體, Ελληνικά - Multi-script text 123!",
      },
      {
        name: "Emoji with skin tones, flags, and ZWJ sequences",
        text: "👨‍👩‍👧‍👦 🏴󠁧󠁢󠁳󠁣󠁴󠁿 👍🏽 ❤️‍🔥 🤖 🌟 👩‍💻 🧪",
      },
      {
        name: "Embedded null bytes and ASCII control characters",
        text: "Header\u0000Body\u0000Footer\u0001\u0007\u001B\u007FEnd",
      },
      {
        name: "Astral plane Unicode code points (U+1F000 - U+1FFFF)",
        text: "🀀 🎴 🎭 🎨 🎪 🎰 🛈 🤹 🧩 🪜",
      },
      {
        name: "Pre-composed NFC character (é: U+00E9)",
        text: "caf\u00E9",
      },
      {
        name: "Decomposed NFD character sequence (e + combining acute: U+0065 U+0301)",
        text: "cafe\u0301",
      },
      {
        name: "Mixed bidirectional text and mark variations",
        text: "English (עברית) - \u200E\u200F \uFE0F text \u0300\u0301\u0302",
      },
    ];

    it.each(testCases)("preserves exact code points for: $name", async ({ text }) => {
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);
      const sender = "GABC";
      const recipient = "GDEF";

      const sealed = await sealEnvelope({ sender, recipient, body: text });
      const opened = await openEnvelope(sealed, keyProviderFor(key, recipient));

      // 1. Decrypted string must equal original string
      expect(opened.body).toBe(text);

      // 2. Exact code point array must match byte-for-byte / point-for-point
      expect(toCodePoints(opened.body)).toEqual(toCodePoints(text));
    });
  });

  describe("Canonicalization & Normalization Separation", () => {
    it("preserves NFC vs NFD distinctions without performing unexpected normalization", async () => {
      const nfcText = "caf\u00E9"; // 'é' (U+00E9)
      const nfdText = "cafe\u0301"; // 'e' (U+0065) + combining acute (U+0301)

      // Visually similar, but distinct code point sequences
      expect(nfcText).not.toBe(nfdText);
      expect(toCodePoints(nfcText)).not.toEqual(toCodePoints(nfdText));

      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const sealedNfc = await sealEnvelope({ sender: "A", recipient: "B", body: nfcText });
      const sealedNfd = await sealEnvelope({ sender: "A", recipient: "B", body: nfdText });

      const openedNfc = await openEnvelope(sealedNfc, keyProviderFor(key, "B"));
      const openedNfd = await openEnvelope(sealedNfd, keyProviderFor(key, "B"));

      // Decrypted text retains its exact input normalization form
      expect(openedNfc.body).toBe(nfcText);
      expect(openedNfd.body).toBe(nfdText);
      expect(openedNfc.body).not.toBe(openedNfd.body);

      // Content commitments for distinct byte representations are distinct
      expect(sealedNfc.payload.content_commitment).not.toBe(sealedNfd.payload.content_commitment);
    });

    it("canonicalization sorts keys deterministically without mutating string code points", () => {
      const payload = {
        z_key: "caf\u00E9",
        a_key: "cafe\u0301",
        emoji: "👨‍👩‍👧‍👦",
        nulls: "a\u0000b",
      };

      const canonical = canonicalizePayload(payload);
      const jcsCanonical = canonicalizeJcs(payload);

      // Keys must be sorted alphabetically
      expect(canonical).toContain('"a_key":"cafe\u0301"');
      expect(canonical.indexOf('"a_key"')).toBeLessThan(canonical.indexOf('"z_key"'));
      expect(jcsCanonical).toBe(canonical);

      // String values inside canonical JSON retain exact code points
      const parsed = JSON.parse(canonical);
      expect(parsed.a_key).toBe(payload.a_key);
      expect(parsed.z_key).toBe(payload.z_key);
      expect(parsed.emoji).toBe(payload.emoji);
      expect(parsed.nulls).toBe(payload.nulls);
    });
  });

  describe("Commitment Determinism & Integrity", () => {
    it("produces deterministic commitments for identical Unicode payloads", async () => {
      const unicodeBody = "🚀 Stealth Mail Protocol: 日本語 & العربية \u0000 👨‍👩‍👧‍👦";
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      // Encrypting a fixed Uint8Array ciphertext produces a deterministic SHA-256 commitment digest
      const testBytes = new TextEncoder().encode(unicodeBody);
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(12) }, key, testBytes));

      const commitment1 = await createCommitment(ct);
      const commitment2 = await createCommitment(ct);

      expect(commitment1).toBe(commitment2);
      expect(commitment1).toMatch(/^v1:sha256:hex:[0-9a-f]{64}$/);
    });
  });

  describe("Boundary Payload Sizes & Attachments", () => {
    it("handles large multi-byte payload round-trips (1MB payload)", async () => {
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      // Repeat a multi-byte string until total length > 1MB
      const baseSegment = "Stealth Unicode Test: 🚀 日本語 العربية \u0000 ";
      const repetitions = Math.ceil((1024 * 1024) / baseSegment.length);
      const largeBody = baseSegment.repeat(repetitions);

      const sealed = await sealEnvelope({ sender: "SENDER", recipient: "RECIPIENT", body: largeBody });
      const opened = await openEnvelope(sealed, keyProviderFor(key, "RECIPIENT"));

      expect(opened.body.length).toBe(largeBody.length);
      expect(opened.body).toBe(largeBody);
    });

    it("handles attachments with Unicode filenames and binary hashes", async () => {
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const attachmentData = new TextEncoder().encode("Attachment content: 📄 テストデータ");
      const sealed = await sealEnvelope({
        sender: "SENDER",
        recipient: "RECIPIENT",
        body: "Message with attachments",
        attachments: [
          {
            filename: "📄_测试_отчёт_2026.pdf",
            content_type: "application/pdf",
            size_bytes: attachmentData.byteLength,
            data: attachmentData.buffer,
          },
        ],
      });

      const opened = await openEnvelope(sealed, keyProviderFor(key, "RECIPIENT"));
      expect(opened.attachments).toHaveLength(1);
      expect(opened.attachments[0].filename).toBe("📄_测试_отчёт_2026.pdf");
      expect(opened.attachments[0].size_bytes).toBe(attachmentData.byteLength);
    });
  });
});
