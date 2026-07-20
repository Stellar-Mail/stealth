import type { Keypair } from "@stellar/stellar-sdk";

import {
  ACTOR_HEADER,
  ACTOR_NONCE_HEADER,
  ACTOR_SIGNATURE_HEADER,
  ACTOR_TIMESTAMP_HEADER,
  buildActorSignaturePayload,
} from "../../../src/server/api/actor";

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function createSignedRequest(
  signer: Keypair,
  url: string,
  init: RequestInit = {},
  options: {
    actor?: string;
    nonce?: string;
    timestamp?: number;
  } = {},
) {
  const actor = options.actor ?? signer.publicKey();
  const nonce = options.nonce ?? crypto.randomUUID();
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const unsigned = new Request(url, init);
  const payload = await buildActorSignaturePayload(unsigned, actor, timestamp, nonce);
  const headers = new Headers(init.headers);

  headers.set(ACTOR_HEADER, actor);
  headers.set(ACTOR_NONCE_HEADER, nonce);
  headers.set(ACTOR_SIGNATURE_HEADER, encodeBase64(signer.sign(payload)));
  headers.set(ACTOR_TIMESTAMP_HEADER, timestamp);

  return new Request(url, { ...init, headers });
}
