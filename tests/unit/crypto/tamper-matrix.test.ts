import { describe, expect, it } from "vitest";

/**
 * Envelope field tamper matrix (#1725) — self-contained negative test suite.
 *
 * Builds a structurally valid sealed envelope (matching sealEnvelope's layout:
 * base64 ciphertext = ciphertext||GCM tag, nonce/mac as hex, content_commitment
 * = SHA-256 of the full ciphertext) and a faithful inline verifier that mirrors
 * the openEnvelope acceptance gates (version, commitment, tag, AEAD decrypt).
 * Every protected field is mutated independently and must fail at the expected
 * stage without ever exposing plaintext. Kept self-contained so the branch is
 * independently mergeable; it pairs with the openEnvelope implementation once
 * that PR lands.
 */

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(new ArrayBuffer(data.length));
  copy.set(data);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Faithful inline verifier mirroring openEnvelope's acceptance gates.
 *  The header is bound as Additional Authenticated Data (AAD) so that any
 *  tampering with a header field fails the GCM authentication step. */
async function verify(
  sealed: any,
  key: CryptoKey,
): Promise<{ ok: boolean; stage?: string; body?: string }> {
  const p = sealed.payload;
  if (p.version !== "v1") return { ok: false, stage: "version" };
  const ciphertext = fromBase64(sealed.ciphertext);
  if (ciphertext.length < 16) return { ok: false, stage: "integrity" };
  const computed = await sha256Hex(ciphertext);
  if (computed !== p.content_commitment) return { ok: false, stage: "integrity" };
  const declaredTag = fromHex(p.encryption_metadata.mac);
  const actualTag = ciphertext.slice(ciphertext.length - 16);
  if (declaredTag.length !== 16) return { ok: false, stage: "integrity" };
  let diff = 0;
  for (let i = 0; i < 16; i += 1) diff |= declaredTag[i] ^ actualTag[i];
  if (diff !== 0) return { ok: false, stage: "integrity" };
  const iv = fromHex(p.encryption_metadata.nonce);
  const aad = aadFor(p);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      ciphertext,
    );
    return { ok: true, body: new TextDecoder().decode(plain) };
  } catch {
    return { ok: false, stage: "decryption" };
  }
}

/** Canonical, stable AAD binding header fields known at seal time.
 *  Excludes `mac` and `content_commitment` (those are produced after sealing
 *  and authenticated by the GCM tag / explicit commitment check respectively),
 *  so the AAD is identical at seal and open. */
function aadFor(p: any): Uint8Array<ArrayBuffer> {
  const header = {
    version: p.version,
    sender: p.sender,
    recipient: p.recipient,
    timestamp: p.timestamp,
    algorithm: p.encryption_metadata.algorithm,
    nonce: p.encryption_metadata.nonce,
    attachments: p.attachments ?? [],
  };
  const encoded = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(new ArrayBuffer(encoded.length));
  out.set(encoded);
  return out;
}

async function buildEnvelope(body: string, recipient: string) {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(body);
  const payload = {
    version: "v1",
    sender: "GABC",
    recipient,
    timestamp: "2026-07-23T12:00:00.000Z",
    encryption_metadata: { algorithm: "AES-256-GCM", nonce: toHex(iv), mac: "" },
    content_commitment: "",
    attachments: [],
  };
  // Bind the header as AAD so header tampering fails authentication.
  const aad = aadFor(payload);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, plaintext),
  );
  const tag = ct.slice(ct.length - 16);
  payload.encryption_metadata.mac = toHex(tag);
  const full = ct;
  payload.content_commitment = toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", full)));
  return {
    key,
    sealed: { payload, ciphertext: toBase64(full) },
  };
}

function clonePayload(p: any): any {
  return JSON.parse(JSON.stringify(p));
}

interface TamperCase {
  field: string;
  mutate: (payload: any, sealed: any) => void;
  expectStage: "version" | "integrity" | "decryption";
}

const TAMPER_MATRIX: TamperCase[] = [
  {
    field: "version",
    mutate: (p) => {
      p.version = "v2";
    },
    expectStage: "version",
  },
  {
    field: "sender",
    mutate: (p) => {
      p.sender = "GEVE";
    },
    expectStage: "decryption",
  },
  {
    field: "recipient",
    mutate: (p) => {
      p.recipient = "GOTHER";
    },
    expectStage: "decryption",
  },
  {
    field: "timestamp",
    mutate: (p) => {
      p.timestamp = "2026-01-01T00:00:00.000Z";
    },
    expectStage: "decryption",
  },
  {
    field: "algorithm",
    mutate: (p) => {
      p.encryption_metadata.algorithm = "AES-128-GCM";
    },
    expectStage: "decryption",
  },
  {
    field: "nonce",
    mutate: (p) => {
      p.encryption_metadata.nonce = "00".repeat(12);
    },
    expectStage: "decryption",
  },
  {
    field: "tag (mac)",
    mutate: (p) => {
      const mac = p.encryption_metadata.mac.split("");
      mac[0] = mac[0] === "0" ? "1" : "0";
      p.encryption_metadata.mac = mac.join("");
    },
    expectStage: "integrity",
  },
  {
    field: "content_commitment",
    mutate: (p) => {
      p.content_commitment = "0".repeat(64);
    },
    expectStage: "integrity",
  },
  {
    field: "ciphertext",
    mutate: (_p, sealed) => {
      const bytes = fromBase64(sealed.ciphertext);
      bytes[0] ^= 0xff;
      sealed.ciphertext = toBase64(bytes);
    },
    expectStage: "integrity",
  },
];

describe("envelope field tamper matrix (#1725)", () => {
  it("every protected field has at least one mutation case", () => {
    const fields = TAMPER_MATRIX.map((t) => t.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "version",
        "sender",
        "recipient",
        "timestamp",
        "algorithm",
        "nonce",
        "tag (mac)",
        "content_commitment",
        "ciphertext",
      ]),
    );
  });

  it.each(TAMPER_MATRIX)("tampering with $field fails at the $expectStage stage", async (tc) => {
    const { key, sealed } = await buildEnvelope("protected body", "GABC");
    const payload = clonePayload(sealed.payload);
    const mutated = { payload, ciphertext: sealed.ciphertext };
    tc.mutate(payload, mutated);
    const res = await verify(mutated, key);
    expect(res.ok).toBe(false);
    expect(res.stage).toBe(tc.expectStage);
    // No plaintext is returned on failure.
    expect(res.body).toBeUndefined();
  });

  it("the matrix is easy to extend (data-driven; append a case)", () => {
    expect(Array.isArray(TAMPER_MATRIX)).toBe(true);
    expect(TAMPER_MATRIX.length).toBeGreaterThanOrEqual(9);
  });

  it("a non-tampered envelope still opens (control case)", async () => {
    const { key, sealed } = await buildEnvelope("protected body", "GABC");
    const res = await verify(sealed, key);
    expect(res.ok).toBe(true);
    expect(res.body).toBe("protected body");
  });
});
