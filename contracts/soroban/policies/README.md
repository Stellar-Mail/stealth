# Policies Contract

Gives each mailbox owner explicit control over who can mail them.

Owners can allow or block individual senders, assign sender-specific postage
tiers, decide whether unknown senders are accepted, require sender
verification, require receipts, and set minimum postage. Explicit precedence is
deterministic: block, allow, tier, then mailbox default.

## Interface

- `set_policy(owner, policy)` writes mailbox defaults as the owner.
- `set_policy_as(owner, actor, policy)` lets owner or a policy-scoped delegate write defaults.
- `get_policy(owner)` reads mailbox defaults.
- `get_versioned_policy(owner)` reads mailbox defaults with version.
- `policy_version(owner)` reads the current version.
- `set_delegate(owner, delegate, scope)` grants or revokes scoped mutation authority.
- `delegate_scope(owner, delegate)` reads delegate scope.
- `set_sender_rule(owner, sender, rule)` allows, blocks, or resets a sender as the owner.
- `set_sender_rule_as(owner, actor, sender, rule)` lets owner or sender-scoped delegate mutate sender rules.
- `set_sender_tier(owner, sender, minimum_postage)` assigns sender-specific pricing as owner.
- `set_sender_tier_as(owner, actor, sender, minimum_postage)` assigns sender-specific pricing as owner or delegate.
- `sender_rule(owner, sender)` reads the current sender override.
- `sender_tier(owner, sender)` reads sender-specific pricing.
- `evaluate(...)` returns the complete decision, reason, required postage, sender rule, and policy version.
- `can_mail(...)` returns the boolean result of `evaluate`.

## Events

Policy, delegate, sender-rule, and sender-tier mutations emit ledger events for
off-chain consumers. The complete public schema—including topic order, payload
encoding, version semantics, and failure-path guarantees—is documented in
[`docs/events.md`](docs/events.md) and pinned by the `event_schema` tests in
`src/lib.rs`.

## Precedence

1. Block always denies, regardless of price or mailbox defaults.
2. Allow always admits the sender.
3. Tier applies sender-specific postage after verification and receipt requirements.
4. Mailbox default applies to unknown/default senders.

## Authorization boundaries

- Owner mutations (`set_policy`, `set_sender_rule`, `set_sender_tier`) require
  the owner's authorization, bound to the exact invocation arguments; a
  signature from any other party is rejected before anything is written.
- `set_delegate` accepts only the owner's authorization. A delegate cannot
  grant, upgrade, or extend their own scope, even with a valid signature over
  the call.
- The `*_as` variants authorize the acting delegate's own signature — the
  owner's is not required at call time — then enforce scope: an actor without
  the matching capability receives the typed `UnauthorizedDelegate` error,
  never a silent write. Scopes are not transitive: `can_set_senders` does not
  imply `can_set_policy`, and vice versa.
- Revoking a delegate (both scope flags false) removes their authority
  immediately; subsequent delegated mutations fail with
  `UnauthorizedDelegate`.
- Failed mutations never bump the policy version and never write sender rules
  or tiers, so the version is a reliable change marker for cached readers.
- All reads (`get_policy`, `get_versioned_policy`, `policy_version`,
  `delegate_scope`, `sender_rule`, `sender_tier`) and the decision functions
  (`evaluate`, `can_mail`) are public and require no authorization.

These boundaries are pinned by the `auth_boundaries` tests in `src/lib.rs`.
