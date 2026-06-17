import type { Email } from "./data";

export interface ProvenanceItemDetails {
  title: string;
  description: string;
  keyValuePairs: { label: string; value: string; isCode?: boolean }[];
  rawJson: string;
}

export interface ProvenanceDetails {
  senderIdentity: {
    raw: string;
    resolved: string;
    resolvedFormatted: string;
    provider: string;
    details: string;
    isVerified: boolean;
    inspector: ProvenanceItemDetails;
  };
  relaySource: {
    nodeId: string;
    domain: string;
    pubkey: string;
    pubkeyFormatted: string;
    signature: string;
    timestamp: string;
    inspector: ProvenanceItemDetails;
  };
  messageHash: {
    raw: string;
    formatted: string;
    algorithm: string;
    sizeBytes: number;
    inspector: ProvenanceItemDetails;
  };
  payloadCommitment: {
    raw: string;
    formatted: string;
    encryptionScheme: string;
    ephemeralKey: string;
    ephemeralKeyFormatted: string;
    inspector: ProvenanceItemDetails;
  };
  postageRecord: {
    txHash: string;
    txHashFormatted: string;
    amount: string;
    escrowAddress: string;
    escrowAddressFormatted: string;
    status: string;
    inspector: ProvenanceItemDetails;
  };
  receiptRecord: {
    contractId: string;
    contractIdFormatted: string;
    txHash: string;
    txHashFormatted: string;
    eventType: string;
    gasUnits: string;
    status: string;
    inspector: ProvenanceItemDetails;
  };
}

// Simple deterministic hash function
function getDeterministicHash(seed: string, salt: string, length: number = 64): string {
  let hash = 0;
  const combined = seed + salt;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash = hash & hash;
  }

  let result = "";
  let currentSeed = Math.abs(hash);
  const hexChars = "0123456789abcdef";
  for (let i = 0; i < length; i++) {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    result += hexChars[currentSeed % 16];
  }
  return result;
}

// Generate a valid-looking Stellar public key G...
function getDeterministicStellarAddress(seed: string, prefix: string = "G"): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const hash = getDeterministicHash(seed, prefix, 55);
  let addr = prefix;
  for (let i = 0; i < 55; i++) {
    const code = hash.charCodeAt(i);
    addr += chars[code % chars.length];
  }
  return addr;
}

function formatIdentifier(id: string, start: number = 6, end: number = 6): string {
  if (id.length <= start + end) return id;
  return `${id.slice(0, start)}...${id.slice(-end)}`;
}

export function getEmailProvenance(email: Email): ProvenanceDetails {
  const seed = email.id;
  const isSmtpBridge = email.folder === "spam" || email.from.toLowerCase().includes("bridge");
  const isRequest = email.folder === "requests" || email.from.toLowerCase().includes("unknown");
  const isVerified =
    !isSmtpBridge &&
    (["verified", "priority", "encrypted", "receipts", "inbox"].includes(email.folder) ||
      !!email.senderPolicy);

  // 1. Sender Identity
  let resolvedKey = "";
  const rawIdentity = email.email || "unknown@stealth.network";

  // Check if raw identity looks like a public key already
  if (/^G[A-Z2-7]{55}$/.test(rawIdentity)) {
    resolvedKey = rawIdentity;
  } else {
    resolvedKey = getDeterministicStellarAddress(rawIdentity, "G");
  }

  const senderProvider = isSmtpBridge
    ? "SMTP DNS Resolver"
    : rawIdentity.includes("*")
      ? "Stellar Federation Server"
      : "Stellar Account Indexer";

  const senderDetails = isSmtpBridge
    ? "DNS verification passed (SPF/DKIM matching domain), but message is missing an on-chain cryptographic signature. Bridged to Stellar by Stealth Bridge Relay."
    : `Successfully resolved federated identity '${rawIdentity}' to public key ${resolvedKey} via Stellar Federation protocols. Cryptographic envelope signature verified.`;

  const senderIdentityInspector: ProvenanceItemDetails = {
    title: "Sender Identity Verification",
    description:
      "Detailed trace of how the sender's identifier was mapped to their cryptographic public key and verified.",
    keyValuePairs: [
      { label: "Identifier", value: rawIdentity },
      { label: "Resolved Public Key", value: resolvedKey, isCode: true },
      { label: "Resolution Protocol", value: senderProvider },
      {
        label: "Status",
        value: isVerified ? "Cryptographically Verified" : "SMTP Unsigned / Bridged",
      },
      {
        label: "Federation URL",
        value: rawIdentity.includes("*")
          ? `https://${rawIdentity.split("*")[1]}/.well-known/stellar.toml`
          : "N/A",
      },
    ],
    rawJson: JSON.stringify(
      {
        identifier: rawIdentity,
        resolved_public_key: resolvedKey,
        protocol: senderProvider,
        verification_status: isVerified ? "SUCCESS" : "UNRESOLVED_SIGNATURE",
        federation_metadata: rawIdentity.includes("*")
          ? {
              domain: rawIdentity.split("*")[1],
              memo_type: "id",
              stellar_address: resolvedKey,
            }
          : null,
        verification_trace: [
          {
            step: 1,
            action: "Lookup domain stellar.toml",
            status: rawIdentity.includes("*") ? "OK" : "SKIP",
          },
          { step: 2, action: "Resolve account alias", status: "OK", result: resolvedKey },
          {
            step: 3,
            action: "Validate cryptographic envelope signature",
            status: isVerified ? "VALID" : "MISSING",
          },
        ],
      },
      null,
      2,
    ),
  };

  // 2. Relay Source
  const nodeNumber = (parseInt(seed) % 12) + 1;
  const relayNodeId = `Node-${nodeNumber.toString().padStart(2, "0")}`;
  const relayDomain = `relay${nodeNumber.toString().padStart(2, "0")}.stealth.network`;
  const relayPubkey = getDeterministicStellarAddress(relayDomain, "G");
  const relaySignature = `sig_${getDeterministicHash(seed, "relay_sig", 64)}`;
  const relayTimestamp =
    email.time.includes("AM") || email.time.includes("PM")
      ? `2026-06-16 ${email.time}`
      : `2026-06-15 14:32:10 UTC`;

  const relaySourceInspector: ProvenanceItemDetails = {
    title: "Relay Node Processing Record",
    description:
      "The decentralised relay node that processed, routed, and committed this message to the network.",
    keyValuePairs: [
      { label: "Relay Name", value: relayNodeId },
      { label: "Relay Domain", value: relayDomain },
      { label: "Relay Public Key", value: relayPubkey, isCode: true },
      { label: "Operator Signature", value: relaySignature, isCode: true },
      { label: "Processing Time", value: relayTimestamp },
    ],
    rawJson: JSON.stringify(
      {
        relay_node_id: relayNodeId,
        routing_domain: relayDomain,
        node_signing_key: relayPubkey,
        routing_signature: relaySignature,
        timestamp: relayTimestamp,
        relayed_metadata: {
          latency_ms: 242,
          ip_anonymized: "127.0.0.1 (VPN Loopback)",
          protocol_version: "stealth-v1.4.2",
        },
      },
      null,
      2,
    ),
  };

  // 3. Message Hash
  const rawMessageHash = getDeterministicHash(seed, email.body, 64);
  const sizeBytes = new Blob([email.body]).size;

  const messageHashInspector: ProvenanceItemDetails = {
    title: "Message Integrity Hash",
    description:
      "The cryptographic SHA-256 digest of the message plaintext used to verify that the email body has not been altered in transit.",
    keyValuePairs: [
      { label: "Hash Algorithm", value: "SHA-256" },
      { label: "Plaintext Hash Digest", value: rawMessageHash, isCode: true },
      { label: "Payload Size", value: `${sizeBytes} bytes` },
    ],
    rawJson: JSON.stringify(
      {
        hash_algorithm: "SHA-256",
        digest: rawMessageHash,
        message_properties: {
          length: email.body.length,
          size_bytes: sizeBytes,
          encoding: "UTF-8",
          has_attachments: !!email.attachments?.length,
        },
        verification: {
          recalculated_hash: rawMessageHash,
          integrity_match: true,
        },
      },
      null,
      2,
    ),
  };

  // 4. Payload Commitment
  const rawPayloadCommitment = getDeterministicHash(seed, "commitment", 64);
  const ephemeralKey = getDeterministicStellarAddress(seed + "ephemeral", "G");

  const payloadCommitmentInspector: ProvenanceItemDetails = {
    title: "Payload Envelope Commitment",
    description:
      "The commitment hash registered on-chain. It proves the message was sent at a specific time without revealing its encrypted contents to the public ledger.",
    keyValuePairs: [
      { label: "Encryption Envelope", value: "Curve25519 (X25519-XSalsa20-Poly1305)" },
      { label: "Commitment Hash", value: rawPayloadCommitment, isCode: true },
      { label: "Ephemeral Session Key", value: ephemeralKey, isCode: true },
    ],
    rawJson: JSON.stringify(
      {
        envelope_type: "X25519-XSalsa20-Poly1305",
        commitment_hash: rawPayloadCommitment,
        session_keys: {
          ephemeral_public_key: ephemeralKey,
          recipient_identity_key: resolvedKey,
        },
        sealed_box: {
          nonce: getDeterministicHash(seed, "nonce", 48),
          mac: getDeterministicHash(seed, "mac", 32),
        },
      },
      null,
      2,
    ),
  };

  // 5. Postage Record
  const postageTxHash = getDeterministicHash(seed, "postage_tx", 64);
  const postageEscrow = getDeterministicStellarAddress(seed + "escrow", "C");
  const postageAmount = isSmtpBridge
    ? "0.00000 XLM (No postage)"
    : isRequest
      ? "0.00500 XLM"
      : "0.00001 XLM";
  const postageStatus = isSmtpBridge
    ? "Bypassed (Bridge Route)"
    : isRequest
      ? "Held in Escrow"
      : "Settled / Fees Burned";

  const postageRecordInspector: ProvenanceItemDetails = {
    title: "On-chain Postage Ledger Entry",
    description:
      "Proof of anti-spam postage payment submitted on the Stellar ledger to purchase delivery priority.",
    keyValuePairs: [
      { label: "Postage Amount", value: postageAmount },
      { label: "Ledger Status", value: postageStatus },
      { label: "Stellar Tx Hash", value: postageTxHash, isCode: true },
      { label: "Escrow Contract", value: postageEscrow, isCode: true },
    ],
    rawJson: JSON.stringify(
      {
        ledger_entry_type: "postage_escrow",
        postage_fee: postageAmount,
        currency: "XLM",
        status: postageStatus,
        stellar_transaction: {
          hash: postageTxHash,
          ledger_sequence: 61200000 + (parseInt(seed) || 123),
          source_account: resolvedKey,
          escrow_contract_id: postageEscrow,
        },
      },
      null,
      2,
    ),
  };

  // 6. Receipt Record
  const receiptContract = getDeterministicStellarAddress(seed + "receipt_contract", "C");
  const receiptTxHash = getDeterministicHash(seed, "receipt_tx", 64);
  const receiptStatus = isSmtpBridge ? "Not Requested" : "Confirmed / Proof Written";

  const receiptRecordInspector: ProvenanceItemDetails = {
    title: "Soroban Delivery Receipt Proof",
    description:
      "Smart contract state confirming the message was delivered and cryptographically acknowledged by the recipient's client.",
    keyValuePairs: [
      { label: "Receipt Contract ID", value: receiptContract, isCode: true },
      { label: "Soroban Tx Hash", value: receiptTxHash, isCode: true },
      { label: "Event Type", value: "read_proof" },
      { label: "Soroban Resource Cost", value: "14,820 CPU Instructions" },
      { label: "Settlement Status", value: receiptStatus },
    ],
    rawJson: JSON.stringify(
      {
        smart_contract: {
          contract_id: receiptContract,
          standard: "SRC-14 (Delivery Receipt)",
          function: "verify_and_settle",
        },
        settlement_tx: receiptTxHash,
        event: {
          topic: "read_proof",
          receipt_commitment: getDeterministicHash(seed, "receipt_commitment", 64),
          recipient_signature: `sig_${getDeterministicHash(seed, "recipient_sig", 64)}`,
        },
        execution_cost: {
          cpu_instructions: 14820,
          rent_bump_fee_xlm: "0.00002",
        },
        status: receiptStatus,
      },
      null,
      2,
    ),
  };

  return {
    senderIdentity: {
      raw: rawIdentity,
      resolved: resolvedKey,
      resolvedFormatted: formatIdentifier(resolvedKey, 6, 6),
      provider: senderProvider,
      details: senderDetails,
      isVerified,
      inspector: senderIdentityInspector,
    },
    relaySource: {
      nodeId: relayNodeId,
      domain: relayDomain,
      pubkey: relayPubkey,
      pubkeyFormatted: formatIdentifier(relayPubkey, 6, 6),
      signature: relaySignature,
      timestamp: relayTimestamp,
      inspector: relaySourceInspector,
    },
    messageHash: {
      raw: rawMessageHash,
      formatted: formatIdentifier(rawMessageHash, 6, 6),
      algorithm: "SHA-256",
      sizeBytes,
      inspector: messageHashInspector,
    },
    payloadCommitment: {
      raw: rawPayloadCommitment,
      formatted: formatIdentifier(rawPayloadCommitment, 6, 6),
      encryptionScheme: "Curve25519 (X25519-XSalsa20-Poly1305)",
      ephemeralKey,
      ephemeralKeyFormatted: formatIdentifier(ephemeralKey, 6, 6),
      inspector: payloadCommitmentInspector,
    },
    postageRecord: {
      txHash: postageTxHash,
      txHashFormatted: formatIdentifier(postageTxHash, 6, 6),
      amount: postageAmount,
      escrowAddress: postageEscrow,
      escrowAddressFormatted: formatIdentifier(postageEscrow, 6, 6),
      status: postageStatus,
      inspector: postageRecordInspector,
    },
    receiptRecord: {
      contractId: receiptContract,
      contractIdFormatted: formatIdentifier(receiptContract, 6, 6),
      txHash: receiptTxHash,
      txHashFormatted: formatIdentifier(receiptTxHash, 6, 6),
      eventType: "read_proof",
      gasUnits: "14,820 Instructions",
      status: receiptStatus,
      inspector: receiptRecordInspector,
    },
  };
}
