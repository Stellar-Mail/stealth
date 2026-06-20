import nacl from "tweetnacl";

export function genKeypair() {
  const kp = nacl.sign.keyPair();
  return { publicKey: kp.publicKey, secretKey: kp.secretKey };
}

function stableSerialize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableSerialize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableSerialize(value[k])).join(",") + "}";
}

export function canonicalize(obj) {
  return stableSerialize(obj);
}

export function signPayload(secretKey, payload) {
  const data = Buffer.from(canonicalize(payload), "utf8");
  const sig = nacl.sign.detached(new Uint8Array(data), secretKey);
  return encodeBase64Url(Buffer.from(sig));
}

export function verifySignature(publicKey, payload, sigB64) {
  const data = Buffer.from(canonicalize(payload), "utf8");
  const sig = decodeBase64Url(sigB64);
  return nacl.sign.detached.verify(new Uint8Array(data), new Uint8Array(sig), publicKey);
}

function encodeBase64Url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(s) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded + "==".slice((2 - ((padded.length * 3) % 4)) % 4), "base64");
}
