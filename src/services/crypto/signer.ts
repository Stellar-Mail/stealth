import { generateKeyPairSync, sign, verify } from "node:crypto";

export interface KeyPair {
  /** PEM-encoded SPKI public key */
  publicKey: string;
  /** PEM-encoded PKCS8 private key */
  secretKey: string;
}

export function genKeypair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, secretKey: privateKey };
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableSerialize).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableSerialize((value as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

export function canonicalize(obj: unknown): string {
  return stableSerialize(obj);
}

export function encodeBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBase64Url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const full = remainder === 0 ? padded : padded + "===".slice(remainder);
  return Buffer.from(full, "base64");
}

export function signPayload(secretKeyPem: string, payload: unknown): string {
  const data = Buffer.from(canonicalize(payload), "utf8");
  const sig = sign(null, data, secretKeyPem);
  return encodeBase64Url(sig);
}

export function verifySignature(publicKeyPem: string, payload: unknown, sigB64: string): boolean {
  const data = Buffer.from(canonicalize(payload), "utf8");
  const sig = decodeBase64Url(sigB64);
  return verify(null, data, publicKeyPem, sig);
}
