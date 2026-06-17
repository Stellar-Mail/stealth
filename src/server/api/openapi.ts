const actorSecurity = [{ ActorHeader: [] }];

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Stealth Mail API",
    version: "1.0.0",
    description:
      "Development API for mailbox policy, Stellar postage proofs, and delivery receipts.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      ActorHeader: {
        type: "apiKey",
        in: "header",
        name: "x-stealth-address",
        description:
          "Development actor transport. Production must derive this identity from a verified signed session.",
      },
    },
    schemas: {
      StellarAddress: {
        type: "string",
        pattern: "^G[A-Z2-7]{55}$",
      },
      Hash32: {
        type: "string",
        pattern: "^[a-f0-9]{64}$",
      },
      StroopAmount: {
        type: "string",
        pattern: "^(0|[1-9][0-9]*)$",
      },
      MailboxPolicy: {
        type: "object",
        required: ["allowUnknown", "minimumPostage", "requireVerified"],
        properties: {
          allowUnknown: { type: "boolean" },
          minimumPostage: { $ref: "#/components/schemas/StroopAmount" },
          requireVerified: { type: "boolean" },
        },
      },
      Device: {
        type: "object",
        required: ["id", "address", "name", "type", "fingerprint", "publicKey", "keyStatus", "trusted", "lastActive", "lastIp", "lastLocation", "createdAt", "isCurrent"],
        properties: {
          id: { type: "string" },
          address: { $ref: "#/components/schemas/StellarAddress" },
          name: { type: "string" },
          type: { type: "string", enum: ["desktop", "mobile", "tablet", "unknown"] },
          fingerprint: { type: "string" },
          publicKey: { type: "string" },
          keyStatus: { type: "string", enum: ["active", "compromised", "revoked", "rotated"] },
          trusted: { type: "boolean" },
          lastActive: { type: "string", format: "date-time" },
          lastIp: { type: "string" },
          lastLocation: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          isCurrent: { type: "boolean" },
        },
      },
      RecoveryMethod: {
        type: "object",
        required: ["id", "address", "type", "label", "value", "createdAt", "lastTestedAt", "disabled"],
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["trusted_contact", "hardware_key", "paper_key", "encrypted_backup"] },
          label: { type: "string" },
          value: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          lastTestedAt: { type: "string", format: "date-time", nullable: true },
          disabled: { type: "boolean" },
        },
      },
    },
  },
  paths: {
    "/health": { get: { summary: "Read service health" } },
    "/protocol": { get: { summary: "Discover protocol capabilities" } },
    "/openapi.json": { get: { summary: "Read this OpenAPI document" } },
    "/policies/{owner}": {
      get: { summary: "Read mailbox policy" },
      put: { summary: "Replace mailbox policy", security: actorSecurity },
    },
    "/policies/{owner}/senders/{sender}": {
      get: { summary: "Read a sender override" },
      put: { summary: "Set a sender override", security: actorSecurity },
      delete: { summary: "Reset a sender override", security: actorSecurity },
    },
    "/policies/evaluate": {
      post: { summary: "Evaluate whether a sender can mail a recipient" },
    },
    "/postage": {
      post: { summary: "Submit a postage proof", security: actorSecurity },
    },
    "/postage/quote": {
      post: { summary: "Quote recipient postage requirements" },
    },
    "/postage/{messageId}": {
      get: { summary: "Read participant postage state", security: actorSecurity },
    },
    "/postage/{messageId}/settle": {
      post: { summary: "Settle pending postage", security: actorSecurity },
    },
    "/postage/{messageId}/refund": {
      post: { summary: "Mark pending postage for refund", security: actorSecurity },
    },
    "/receipts": {
      post: { summary: "Record message delivery", security: actorSecurity },
    },
    "/receipts/{messageId}": {
      get: { summary: "Read participant receipt state", security: actorSecurity },
    },
    "/receipts/{messageId}/read": {
      post: { summary: "Record recipient read acknowledgment", security: actorSecurity },
    },
    "/devices": {
      get: { summary: "List registered devices with session info", security: actorSecurity },
    },
    "/devices/register": {
      post: { summary: "Register a new device", security: actorSecurity },
    },
    "/devices/recovery": {
      get: { summary: "Read account recovery status", security: actorSecurity },
    },
    "/devices/{deviceId}": {
      get: { summary: "Read a specific device", security: actorSecurity },
    },
    "/devices/{deviceId}/name": {
      put: { summary: "Rename a device", security: actorSecurity },
    },
    "/devices/{deviceId}/trust": {
      post: { summary: "Toggle device trust status", security: actorSecurity },
    },
    "/devices/{deviceId}/revoke": {
      post: { summary: "Revoke a device", security: actorSecurity },
    },
    "/devices/{deviceId}/compromised": {
      post: { summary: "Flag a device as compromised", security: actorSecurity },
    },
    "/devices/rotate-keys": {
      post: { summary: "Rotate encryption keys for devices", security: actorSecurity },
    },
    "/devices/recovery-methods": {
      get: { summary: "List recovery methods", security: actorSecurity },
      post: { summary: "Create a recovery method", security: actorSecurity },
    },
    "/devices/recovery-methods/{methodId}": {
      delete: { summary: "Delete a recovery method", security: actorSecurity },
    },
    "/sessions/{sessionId}/revoke": {
      post: { summary: "Revoke a specific session", security: actorSecurity },
    },
  },
} as const;
