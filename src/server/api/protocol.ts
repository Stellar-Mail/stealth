export const protocolManifest = {
  apiVersion: "v1",
  supportedVersions: ["v1", "v2"],
  mandatoryCapabilities: [
    // mandatory caps that must be present in any peer
    "mailbox-policy",
    "sender-rules",
    "policy-evaluation",
  ],
  authentication: {
    actorHeader: "x-stealth-address",
    productionRequirement: "signed session or wallet challenge",
    status: "development-transport",
  },
  capabilities: [
    "mailbox-policy",
    "sender-rules",
    "policy-evaluation",
    "postage-quotes",
    "postage-lifecycle",
    "delivery-receipts",
    "read-receipts",
    "message-lifecycle",
  ],
  contracts: {
    policies: ["set_policy", "get_policy", "set_sender_rule", "sender_rule", "can_mail"],
    postage: ["minimum", "quote", "submit", "settle", "refund", "get"],
    receipts: ["delivered", "read", "get"],
    lifecycle: ["initialize", "config", "bind", "verify_settle", "verify_read", "get"],
  },
  persistence: {
    adapter: "memory",
    durable: false,
  },
} as const;
