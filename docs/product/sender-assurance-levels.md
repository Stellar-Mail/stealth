# Sender Assurance Levels Specification

## Why this matters

A single binary "verified" badge collapses fundamentally different security guarantees, leading to user confusion and susceptibility to phishing/identity spoofing. Standardizing distinct levels of cryptographic and social proof ensures users can accurately gauge message assurance.

---

## 1. Assurance States & Evidence Requirements

Below are the six defined assurance states, ordered from highest to lowest level of assurance.

| State / Badge             | User-Facing Label             | Evidence Required (Machine-Readable)                                                                                                                                    | Cryptographic Assurance Claim                                                                              |
| :------------------------ | :---------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **Trusted Contact**       | `Allowed` or `Contact`        | The sender's public key exists in the user's local contact database (explicit user action: `allow`).                                                                    | High social trust. Authenticated by a valid cryptographic signature matching the saved key.                |
| **Native Identity**       | `Verified`                    | The sender's domain/alias resolves via a Stellar Federation Server (stellar.toml) matching a validated ledger public key with a valid cryptographic envelope signature. | High cryptographic identity mapping to a known handle (e.g. `user*stealth.demo`).                          |
| **Verified Organization** | `Org`                         | Resolved via organization ledger registry contract, backed by multi-signature keys and registered DNS records.                                                          | Cryptographic assurance that the sender represents a legally registered or audited entity.                 |
| **Paid Unknown Sender**   | `Paid`                        | A valid postage escrow preimage and Soroban contract postage transaction fee settled on-chain. Sender is not in contacts.                                               | Financial deterrence proof. Message is paid to bypass default quarantine/spam filters.                     |
| **SMTP Bridge Mail**      | `Bridged`                     | SPF/DKIM DNS record validation matches the source domain, but the message lacks a Stellar ledger envelope signature (bridged via SMTP gateway).                         | Lower assurance. Authenticity is bounded by DNS/legacy security protocols; vulnerable to relay compromise. |
| **Failed Proof**          | `Warning` (or `Failed Proof`) | The signature fails verification, the payload commitment does not match the ledger anchor, or the postage transaction is invalid/double-spent.                          | Malicious/Compromised. High risk of tampering or spoofing.                                                 |

---

## 2. Downgrade & Conflicting-Proof Behavior

When multiple verification proofs are present or conflict, the system resolves them based on the following deterministic hierarchy:

1. **Failure Precedence**: If any cryptographic proof fails validation (signature mismatch, altered body hash, invalid postage proof), the message is immediately downgraded to the **Failed Proof** state (`Warning`), regardless of whether the sender was previously in contacts or federation list.
2. **Conflict Resolution**:
   - If a sender is in the user's **Trusted Contacts** (`Allowed`) but their federation record indicates a key change, the client flags a warning asking the user to update the contact.
   - If a message claims to be from a **Verified Organization** but is delivered via an **SMTP Bridge** without the organization's on-chain signature, it must be downgraded to **SMTP Bridge Mail** and render a prominent spoofing warning.
3. **Stacked Badges (List vs Reader View)**:
   - On compact surfaces (inbox list row), only the primary state takes precedence.
   - On detail views (reader), badges can stack (e.g., a message can be `Encrypted` and `Allowed` or `Paid` and `Verified`).

---

## 3. UI Examples & Layouts

### A. Inbox List Row (Compact View)

Compact rows display the single highest-priority badge:

- **From**: `support*stellar.org` `[Org]`
- **From**: `alice*stealth.demo` `[Allowed]`
- **From**: `unknown*gmail.com` `[Paid]`
- **From**: `spammer*compromised.com` `[Warning]`

### B. Message Reader Header

The detailed header presents stacked credentials and a clickable "Technical Provenance" accordion:

```text
+--------------------------------------------------------------+
| Subject: Invoice Details                                     |
| From: Ada Lovelace <ada@demo.stealth> [Verified] [Encrypted]  |
|                                                              |
| [Technical Provenance v]                                     |
|  - Sender Identity: Verified via Stellar Federation          |
|  - Envelope Hash: sha256:3aef...102a (Verified)              |
|  - Postage Record: 0.00001 XLM (Settled)                     |
+--------------------------------------------------------------+
```

### C. Compose Mode

When composing a message, the client displays the target recipient's assurance preview based on the local address book and federation cache:

- Typing `bob*stealth.demo` -> displays inline: `[Bob Demo - Contact]`
- Typing `stranger*example.com` -> displays inline: `[Unknown Destination - Requires 0.005 XLM Postage]`

### D. Security Warning Panel (Failed Proofs / Bridge Spooting)

For **Failed Proofs** or suspicious **SMTP Bridge** messages claiming high-trust domains:

```text
+--------------------------------------------------------------+
| /!\ SECURITY WARNING: Cryptographic Verification Failed      |
| This message failed its integrity check. The sender's signature |
| does not match the message contents, suggesting it was altered|
| in transit or spoofed. Do not click links or open attachments. |
|                                                              |
| [Block Sender] [Ignore Warning]                              |
+--------------------------------------------------------------+
```

---

## 4. Success Signal

This specification is validated when **90% of usability participants** correctly rank representative messages by assurance:

1. `[Allowed]` / `[Org]` (Highest)
2. `[Verified]`
3. `[Paid]`
4. `[Bridged]`
5. `[Unknown]`
6. `[Warning]` (Lowest / Danger)
