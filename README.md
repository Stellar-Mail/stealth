# Stealth

> **Your inbox. Your rules. Proof for every delivery.**

![Stealth Mail protocol interface](docs/assets/stealth-mail-interface.jpg)

Stealth is a private, programmable mail protocol built on Stellar. You decide who can reach you, what unknown senders must pay, and which delivery claims deserve trust.

Email was built to let anyone enter your inbox. That openness became spam, phishing, impersonation, and a security model held together by domain reputation. Stealth starts with a different rule: **access is earned, not assumed.** Trusted people should reach you immediately. Everyone else must satisfy the policy you choose: verified identity, minimum postage, explicit approval, or no access at all.

## Why Stealth

- **You control access.** Allow, block, or price unknown senders before they enter your inbox.
- **Identity is verifiable.** Stellar accounts and federation addresses give senders cryptographic identities instead of display-name trust.
- **Spam has a cost.** Optional micro-postage changes bulk abuse from free to economically measurable.
- **Delivery has proof.** Message hashes, postage proofs, and receipts create an auditable delivery trail without putting private message bodies on-chain.
- **Messages stay private.** Encrypted payloads remain off-chain; Stellar anchors identity, policy, payment references, and proof.
- **Safety stays fast.** Stellar's low-cost settlement keeps verification and anti-spam controls practical for everyday mail.

## The Protocol

1. **Resolve identity.** A human-readable Stealth address resolves to a Stellar account and encryption keys.
2. **Check mailbox policy.** The sender learns whether they are trusted, blocked, required to verify, or required to attach postage.
3. **Encrypt and send.** The client encrypts the message body and submits it to a relay or recipient-controlled storage.
4. **Anchor the proof.** The message hash and payment reference are recorded without exposing message content.
5. **Verify before rendering.** The client checks sender identity, payload integrity, postage, and delivery state.

API implementers should follow the [signed API authentication protocol v1](docs/security/api-authentication-v1.md)
for canonical requests, required headers, challenge validity, signature verification, replay
protection, error responses, and executable synthetic interoperability vectors.

Stealth turns the inbox from an open endpoint into a programmable, privacy-preserving communication boundary.
