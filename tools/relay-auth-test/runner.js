import { genKeypair, signPayload, canonicalize } from './lib/signer.js';
import { createServer } from './lib/server.js';
import { nanoid } from 'nanoid';

async function run() {
  const server = createServer();
  await server.listen({ port: 0 });
  const addr = server.server.address();
  const url = `http://127.0.0.1:${addr.port}/relay`;
  console.log('Server running at', url);

  const kp = genKeypair();
  const pubB64 = Buffer.from(kp.publicKey).toString('base64url');

  // helper to create envelope
  function makeEnvelope(overrides = {}) {
    const payload = {
      method: 'POST',
      path: '/v1/messages',
      query: null,
      headers: { host: 'example.local' },
      body_hash: 'd41d8cd98f00b204e9800998ecf8427e',
      created_at: new Date().toISOString(),
      nonce: nanoid(24),
      aud: 'urn:example:recipient',
      ...overrides,
    };
    const signature = signPayload(kp.secretKey, payload);
    return { payload, signature, kid: 'test-kid', alg: 'Ed25519', pub: pubB64 };
  }

  // Test 1: First delivery -> expect 200
  const env1 = makeEnvelope();
  let r = await fetch(url, { method: 'post', body: JSON.stringify(env1), headers: { 'Content-Type': 'application/json' } });
  console.log('Test1 status', r.status);

  // Test 2: Replay same envelope -> expect 409
  r = await fetch(url, { method: 'post', body: JSON.stringify(env1), headers: { 'Content-Type': 'application/json' } });
  console.log('Test2 status', r.status, await r.text());

  // Test 3: Different relay (same envelope) - same as above
  // Already simulated by Test2; to show idempotency with key reuse

  // Test 4: Future timestamp beyond skew -> expect 400
  const futurePayload = makeEnvelope({ created_at: new Date(Date.now() + 120 * 1000).toISOString() });
  r = await fetch(url, { method: 'post', body: JSON.stringify(futurePayload), headers: { 'Content-Type': 'application/json' } });
  console.log('Test4 status', r.status, await r.text());

  // Test 5: Idempotency key
  const envId = makeEnvelope({ idempotency_key: 'abc-123' });
  r = await fetch(url, { method: 'post', body: JSON.stringify(envId), headers: { 'Content-Type': 'application/json' } });
  console.log('Test5 first', r.status, await r.text());
  r = await fetch(url, { method: 'post', body: JSON.stringify(envId), headers: { 'Content-Type': 'application/json' } });
  console.log('Test5 second', r.status, await r.text(), 'header:', r.headers.get('X-Idempotency-Replayed'));

  // Test 6: Modified body but same signature (tamper) -> we can't keep signature valid; simulate by changing payload but not updating signature
  const tampered = makeEnvelope();
  tampered.payload.body_hash = 'changed';
  // Keep signature from original
  tampered.signature = signPayload(kp.secretKey, makeEnvelope().payload); // signature doesn't match
  r = await fetch(url, { method: 'post', body: JSON.stringify(tampered), headers: { 'Content-Type': 'application/json' } });
  console.log('Test6 status', r.status, await r.text());

  await server.close();
}

run().catch(err => { console.error(err); process.exit(1); });
