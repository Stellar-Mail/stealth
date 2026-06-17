# Security

Threat models, abuse cases, key-handling assumptions, audit notes, and privacy/security reviews.

## Threat Model and Mitigation Register

Status: pre-alpha, not audited. This register tracks the trust assumptions
that exist in the codebase today, not an idealized future architecture. It
will be revised as the relay, crypto, and storage services move out of
placeholder state (see Scope below).

### Scope and method

This register was built by reading the current implementation rather than
designing from the protocol description alone. Each row cites the file(s)
that produce or fail to produce the relevant guarantee. Where a control does
not exist yet, the register says so explicitly instead of describing planned
behavior as if it were shipped.

Subsystems covered: Soroban contracts (contracts/soroban/policies,
postage, receipts), the off-chain API/relay layer
(src/server/api/*, src/routes/api/v1/*), abuse/rate-limiting
(src/server/api/abuse-service.ts), relay federation
(src/services/relay/federation.ts), client trust rendering
(src/components/mail/trust-state.ts, data.ts), and the legacy-email
bridge roadmap (docs/product/legacy-email-interoperability-roadmap.md).

### Assets

- Mailbox policy state (allow/block rules, postage minimums) - on-chain in
  PoliciesContract, mirrored off-chain in MemoryApiRepository.
- Postage funds in escrow - on-chain in PostageContract, token-custodied
  by the contract address.
- Delivery/read receipts - on-chain in ReceiptsContract, mirrored
  off-chain with weaker integrity checks (see R5).
- Encrypted message payloads - architecturally off-chain; no storage or
  encryption implementation exists yet (see R6).
- Sender/recipient identity claims carried in API requests and relay
  federation messages.
- Trust labels rendered in the client UI (verified, bridged,
  encrypted, paid).

### Actors

- Mailbox owner (controls policy and sender rules for their address).
- Sender (wants to deliver mail, may be trusted, unknown, or malicious).
- Relay operator (runs the off-chain API/relay that receives, rate-limits,
  and forwards mail).
- Federated peer relay (a different operator's relay, reached via domain
  resolution in federation.ts).
- Legacy SMTP bridge (future component per the interoperability roadmap;
  not yet implemented).
- Network attacker / unauthenticated client (anyone who can send HTTP
  requests to a relay's API).

### Trust boundaries

1. Client to Relay API (src/routes/api/v1/*) - currently authenticated
   only by a self-asserted header, see R1.
2. Relay to Soroban contracts - contract calls enforce require_auth()
   correctly where wired (settle/refund/dispute/reclaim), but the postage
   API route never calls the contract at all, see R2.
3. Relay to Relay (federation) - no message-level authentication exists,
   see R3.
4. Relay process to its own state - in-memory only, no durable backing
   store wired up despite docker-compose.yml provisioning Redis, see R4.
5. Off-chain mirror to on-chain contract state - the two are independently
   implemented and have already diverged in strictness, see R5.
6. Stealth-native mail to legacy SMTP bridge - not yet implemented, but the
   roadmap document defines the boundary and the labeling rule that must
   hold once it is, see R7.

---

### R1 - Identity is self-asserted, not cryptographically verified

Abuse paths covered: account takeover, spam, phishing.

Trust boundary: Client to Relay API.

Current behavior: requireActor / requireActorMatches in
src/server/api/actor.ts read the x-stealth-address header, validate it
is shaped like a Stellar G-address, and compare it to a field in the
request body. There is no signature, no SEP-10 challenge, no proof of key
ownership anywhere in the request path. Any caller can claim any address.
This is consistent across every route that calls requireActorMatches:
src/routes/api/v1/postage/index.ts, .../postage/$messageId/settle.ts,
.../receipts/index.ts, .../receipts/$messageId/read.ts,
.../policies/$owner.ts.

The project already discloses this gap in two places:
src/server/api/protocol.ts labels authentication.status as
"development-transport" and states the
productionRequirement: "signed session or wallet challenge".
src/server/api/openapi.ts repeats this as
"Development actor transport. Production must derive this identity from a
verified signed session."

Mitigation (code): Replace requireActor with verification of a signed
challenge (SEP-10 web auth or an equivalent wallet-signed session token)
before trusting any sender/owner claim. Soroban contract calls already
do this correctly via require_auth() (policies/src/lib.rs,
postage/src/lib.rs, receipts/src/lib.rs) - the gap is specific to the
off-chain HTTP layer, not the protocol design.

Mitigation (operations): Do not expose the current API routes to
production traffic or treat their authorization as a real boundary until
R1 is closed. The pre-alpha/not-audited status in README.md should
explicitly name this as a blocking item for public beta, matching the
issue's acceptance criteria.

Owner: needs maintainer assignment (tracked via #81 follow-up; this row blocks public beta).

Residual risk: High until closed. This is the root cause behind most
of the issue's named abuse paths (account takeover, spam, phishing all
become trivial once identity is unauthenticated).

Validation plan: Add an integration test that asserts a request with a
mismatched or unsigned x-stealth-address is rejected once signed-session
auth lands; until then, add a test asserting the current behavior is
documented as development-transport so a silent promotion to production
can't happen without the test failing.

---

### R2 - Postage submission is not verified against the chain

Abuse paths covered: spam, contract bugs (state divergence).

Trust boundary: Relay to Soroban contracts.

Current behavior: submitPostage in src/server/api/postage-service.ts
accepts amount, sender, recipient, and paymentHash directly from the
client-submitted JSON body (validated only for shape via
stroopAmountSchema / hash32Schema in
src/routes/api/v1/postage/index.ts) and writes them straight into
MemoryApiRepository as a pending postage record. Nothing in this path
calls the PostageContract's submit() or get() functions, calls
Horizon/RPC to check a real Stellar payment, or validates paymentHash
against anything. The README's claim that "relays must verify the
referenced Stellar payment" is not implemented in this code path; the field
is accepted and dropped.

Mitigation (code): Before persisting a postage record, the relay must
either call into PostageContract::submit (so the escrow transfer and
duplicate-message check happen on-chain) or independently verify the
referenced payment via Horizon/RPC and reject submissions that don't match.
paymentHash should be checked, not merely shape-validated.

Owner: relay/API maintainers — needs maintainer assignment (tracked via #81 follow-up).

Residual risk: High. Combined with R1, a caller can self-report
arbitrary postage for arbitrary identities with zero on-chain cost,
defeating the project's core anti-spam mechanism.

Validation plan: Add a test that submits a postage record with a
paymentHash that does not correspond to any real Stellar transaction and
assert it is rejected once on-chain verification is wired in.

---

### R3 - Relay federation has no message-level authentication or durable replay protection

Abuse paths covered: malicious relays, replay.

Trust boundary: Relay to Relay (federation).

Current behavior: FederationDeliveryService in
src/services/relay/federation.ts resolves a peer relay's publicKey via
resolveRelay, but nothing in the class uses that key to verify a
signature, authenticate the HTTP call in transmitMessage, or encrypt
anything end-to-end - the field is present in the RelayNode type but
structurally unused. Deduplication relies on an in-memory
seenMessageIds: Set<string>, explicitly commented in the source as a
stand-in: "in a real system, this is backed by Redis/DB." A restarted
relay process forgets every message it has already seen, and a malicious
or compromised peer can forge FederationMessage.id / recipientDomain /
payload freely since nothing authenticates message origin at this layer.

Mitigation (code): Require the resolved publicKey to verify a
signature over each FederationMessage before acting on it; back
seenMessageIds with the same durable store referenced in
infra/docker-compose.yml (Redis) rather than an in-process Set.

Owner: relay/federation maintainers — needs maintainer assignment (tracked via #81 follow-up).

Residual risk: High for federated/multi-relay deployments; lower for a
single-relay pilot deployment where this code path isn't yet exercised
cross-operator.

Validation plan: Unit test that a FederationMessage claiming to come
from a peer it didn't sign is rejected; integration test that a relay
restart does not allow replay of a previously delivered message ID.

---

### R4 - Abuse-prevention and dedup state is in-memory and per-process only

Abuse paths covered: spam.

Trust boundary: Relay process to its own state.

Current behavior: MemoryApiRepository
(src/server/api/memory-repository.ts) is the only implementation of
ApiRepository (src/server/api/repository.ts) in the codebase. All rate
limits computed in src/server/api/abuse-service.ts
(checkAccountLimit, checkIpLimit, checkDeviceLimit,
checkSenderRecipientLimit, checkRelayLimit, checkProofFailureLimit)
are backed by an in-process Map. This state is lost on every restart and
is not shared across instances if the relay is horizontally scaled. This
contradicts infra/docker-compose.yml, which provisions a redis service
and passes REDIS_URL into the relay container's environment - the
infrastructure intent and the current implementation have already
diverged. protocol.ts discloses persistence: { adapter: "memory",
durable: false }.

Mitigation (code): Implement a Redis-backed (or equivalent durable)
ApiRepository and use it in any deployment that isn't a single
ephemeral dev instance; this is consistent with what docker-compose.yml
already assumes.

Owner: relay/infra maintainers — needs maintainer assignment (tracked via #81 follow-up).

Residual risk: Medium-high for any production or multi-instance
deployment; low for local single-process development, which is this
implementation's actual current use case.

Validation plan: Load test that restarts the relay mid-burst and
confirms whether rate limits reset (expected to fail today; should pass
once R4 is closed). Track via a dedicated issue referencing this section.

---

### R5 - Off-chain API mirrors are weaker than the on-chain contracts they shadow

Abuse paths covered: contract bugs / state divergence, metadata
integrity, account takeover.

Trust boundary: Off-chain mirror to on-chain contract state.

Current behavior: The off-chain TypeScript services duplicate contract
logic with reduced guarantees in at least three places:

- evaluateMailboxPolicy (src/server/api/policy-service.ts) re-implements
  PoliciesContract::evaluate but takes verified as a plain client-passed
  boolean, same as the contract - and is not currently wired to any HTTP
  route, so this divergence is latent rather than live.
- createDeliveryReceipt (src/server/api/receipt-service.ts) and its
  route schema (src/routes/api/v1/receipts/index.ts) have no
  payloadHash field at all, whereas ReceiptsContract::delivered
  (contracts/soroban/receipts/src/lib.rs) enforces that a duplicate
  message ID must match the original payload_hash, protocol_version,
  sender, and recipient, returning CommitmentMismatch otherwise. The
  off-chain mirror has no equivalent integrity check.
- The off-chain policy route (src/routes/api/v1/policies/$owner.ts) only
  allows owner === actor; it has no equivalent to the contract's scoped
  delegate model (DelegateScope, set_delegate, authorize_policy_mutation
  in policies/src/lib.rs), so delegated policy management exercised by
  the contract's own test suite isn't reachable through this API at all.

Mitigation (code): Either route mutations through the contracts
directly (closing the gap by construction) or bring the off-chain schemas
and checks up to parity with the contract's invariants, particularly the
receipt commitment check.

Owner: relay/API maintainers — needs maintainer assignment (tracked via #81 follow-up).

Residual risk: Medium today (since evaluateMailboxPolicy isn't live);
will become high if these routes go live without closing the gap first.

Validation plan: Contract-parity test suite that runs the same
fixture (protocol/vectors/vectors.json) against both the Rust contract
and the TypeScript services and fails on any behavioral divergence.

---

### R6 - No encryption, key management, or storage implementation exists yet

Abuse paths covered: metadata exposure, phishing (indirectly, via
unverifiable payload integrity).

Trust boundary: N/A - control does not exist to have a boundary yet.

Current behavior: src/services/crypto/README.md,
src/services/stellar/README.md, and src/services/storage/README.md
are placeholder files describing intended responsibilities ("Encryption,
signing, verification, key derivation, and payload hash helpers" /
"Off-chain encrypted payload storage adapters") with no implementation
behind them. There is no encryption library in package.json (no
tweetnacl, libsodium, noble libraries, etc.) and no encrypt/decrypt
function defined anywhere in src/. The only Stellar-related dependency
is @stellar/freighter-api (wallet connector); there is no
@stellar/stellar-sdk dependency for building or verifying transactions.

Mitigation: None to map yet - this is a build item, not a
mitigation-register item, until the implementation exists. Listed here so
it isn't silently assumed to be done because the README describes the
target architecture.

Owner: needs maintainer assignment and a tracked issue distinct from #81.

Residual risk: N/A pending implementation; the project's own
README.md already states "Pre-alpha. Not audited. Not ready for
production funds or sensitive mail," which this finding directly
substantiates.

Validation plan: Once implemented, require documented key-derivation
and encryption review before any payload leaves the client unencrypted in
any code path.

---

### R7 - Client trust labels are derived from unverified metadata, not cryptographic checks

Abuse paths covered: phishing, metadata, bridge downgrade.

Trust boundary: Stealth-native mail to legacy SMTP bridge (future);
relay/storage to client rendering (current).

Current behavior: getTrustStates and getPrimaryTrustState
(src/components/mail/trust-state.ts) derive verified, bridged,
encrypted, and paid badges purely from fields on the Email object
(labels, senderPolicy, verifiedSender, folder,
postageAmount) - isVerified (src/components/mail/data.ts) currently
just checks which mock folder a message is filed under. None of this
performs a cryptographic check; whatever populates the Email object
(today, fixture data; eventually, a relay or storage backend) fully
controls what badge is shown.

This matters specifically for the bridge-downgrade criterion: the
interoperability roadmap (docs/product/legacy-email-interoperability-roadmap.md)
already specifies the correct policy in writing - bridged SMTP mail must
remain labeled "SMTP Bridged (Unsigned)" and must not be promotable to
"Cryptographically Verified" status without fully native proof, even on
a domain that has also completed native verification (see "Phase 4:
Domain verification and native upgrades" in that document). The current
getTrustStates implementation has no enforcement mechanism for that rule
- it will render whatever label the underlying data claims.

Mitigation (code): Once a real relay/storage data source exists,
getTrustStates must derive verified and bridged from
server-attested, cryptographically-checked fields, not arbitrary
relay-supplied flags. Add an explicit invariant test asserting bridged
mail can never simultaneously carry the verified state, matching the
roadmap's distinguishability principle.

Owner: client/design-system maintainers plus bridge implementation owner
(both untracked).

Residual risk: Low today (mock data only, no live bridge); will be
high once a live SMTP bridge or live relay feed is wired into this
component, unless the invariant is enforced before that lands.

Validation plan: Unit test added now (before the bridge exists) that
encodes the invariant "a message in folder/label state X can never
simultaneously report verified and bridged," so the bridge
implementation either satisfies it or fails CI on day one.

---

### R8 - PostageContract::initialize has no caller authorization

Abuse paths covered: contract bugs.

Trust boundary: Relay/deployer to Soroban contract.

Status: Fixed in this PR.

Previous behavior: initialize in
contracts/soroban/postage/src/lib.rs checked that the contract had not
already been configured (Error::AlreadyInitialized) and validated the
minimum/fee_bps/expiry_seconds parameters, but never called
require_auth() on any address. On a public network, whoever submitted
the first successful initialize call could set asset, treasury, and
fee_bps for the entire contract instance - there was no check that the
caller was the intended deployer/admin.

Current behavior: initialize now takes an admin: Address parameter and
calls admin.require_auth() immediately after the already-initialized
check, before any of the validation or the EscrowConfig write. A call
without the admin's authorization panics with Error(Auth,
InvalidAction), confirmed by the initialize_without_admin_auth_fails
test.

Mitigation (code): Implemented - admin: Address added as a parameter
and admin.require_auth() is called immediately after the
already-initialized check, before any validation or the EscrowConfig
write, consistent with the auth pattern already used elsewhere in this
contract (submit, dispute, reclaim, and resolve all call
require_auth() on the relevant party). All three test-suite call sites
were updated to pass an admin address; trusted_sender_has_zero_quote
additionally needed env.mock_all_auths() added, since it previously ran
without it.

Owner: karanjadavi (fixed in this PR; see contracts/soroban/postage/src/lib.rs).

Residual risk: Low - require_auth() is now enforced and covered by a
dedicated test (initialize_without_admin_auth_fails). Residual exposure
is limited to whoever controls the admin key at deployment time, which
is an operational concern, not a code gap.

Validation plan: Implemented - initialize_without_admin_auth_fails
(contracts/soroban/postage/src/lib.rs) asserts initialize panics with
Error(Auth, InvalidAction) when called without admin authorization,
mirroring the existing scoped_delegate_authorization_is_enforced test
style used in policies/src/lib.rs.

---

### Summary table

| ID | Risk | Abuse paths (issue criteria) | Mitigation type | Owner | Residual risk |
| --- | --- | --- | --- | --- | --- |
| R1 | Self-asserted identity, no signature check | Account takeover, spam, phishing | Code (signed session/SEP-10) | Needs assignment | High |
| R2 | Postage not verified on-chain | Spam | Code (contract or Horizon verification) | Needs assignment | High |
| R3 | No relay-to-relay message auth; in-memory dedup | Malicious relays, replay | Code (signature + durable store) | Needs assignment | High (federated) |
| R4 | Abuse state is in-memory only | Spam | Code (Redis-backed repository) | Needs assignment | Medium-high (multi-instance) |
| R5 | Off-chain mirrors weaker than contracts | Contract bugs, metadata, account takeover | Code (parity tests/route through contracts) | Needs assignment | Medium |
| R6 | No encryption/key/storage implementation | Metadata | Build item (not yet a control) | Needs assignment | N/A pending build |
| R7 | Trust badges trust unverified metadata | Phishing, metadata, bridge downgrade | Code (invariant enforcement) | Needs assignment | Low today, high once bridge ships |
| R8 | initialize lacks admin auth | Contract bugs | Code (require_auth added, fixed in this PR) | karanjadavi | Low |

### Open items for review before public beta

- Every row above lists "Unassigned" - per the issue's success signal ("no
  critical trust assumption remains undocumented or ownerless"), each row
  needs a named owner before this can be considered complete, not just a
  filed document.
- R6 needs its own tracked issue (encryption/key management/storage are
  build items, not yet mitigations) rather than living only in this
  register.
- R1 and R2 are blocking for any deployment that touches real funds or
  real mailboxes; they should gate public beta per the issue's acceptance
  criteria.
