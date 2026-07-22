const signedRequestSecurity = [{ StellarSignedRequest: [] }];

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
      StellarSignedRequest: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "SEP-10 JWT",
        description:
          "Authenticates a Stellar account through the [SEP-10 Web Authentication](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md) challenge flow. Fetch a short-lived challenge transaction from the service's WEB_AUTH_ENDPOINT, verify the server signature and transaction fields, sign the challenge with an authorized Stellar account signer, and exchange the signed transaction for a token. Send that token on protected API calls as `Authorization: Bearer <SEP-10-token>`. Never send a Stellar secret seed. The server derives the actor from the verified token and enforces challenge expiry and replay protection; `x-stealth-address` alone is not proof of identity.",
        "x-required-headers": ["Authorization"],
        "x-signing-specification":
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md",
        "x-challenge-flow": [
          "Request a challenge transaction from the WEB_AUTH_ENDPOINT for the Stellar account.",
          "Validate the challenge according to SEP-10 before signing it.",
          "Sign the challenge with an authorized account signer and return the signed transaction.",
          "Use the returned short-lived token in the Authorization header for protected operations.",
        ],
        "x-header-example": "Authorization: Bearer <SEP-10-token>",
      },
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
      ValidationErrorItem: {
        type: "object",
        required: ["path", "rule", "message"],
        additionalProperties: false,
        properties: {
          path: {
            type: "string",
            description:
              "Safe request field path using dot and bracket notation; root errors use $.",
            examples: ["recipient", "tags[0]", "$"],
          },
          rule: {
            type: "string",
            description:
              "Application-owned validation rule code, independent of validator libraries.",
            enum: [
              "invalid_type",
              "format",
              "min_length",
              "max_length",
              "minimum",
              "maximum",
              "missing",
              "unknown_field",
              "invalid_value",
            ],
          },
          message: {
            type: "string",
            description:
              "Human-readable validation guidance. Rejected input values are never echoed.",
          },
        },
      },
      ValidationErrorDetails: {
        type: "object",
        required: ["validationErrors"],
        additionalProperties: false,
        properties: {
          validationErrors: {
            type: "array",
            items: { $ref: "#/components/schemas/ValidationErrorItem" },
          },
        },
      },
      PolicyEvaluationDecision: {
        type: "object",
        required: ["allowed", "reasonCode", "message"],
        additionalProperties: false,
        properties: {
          allowed: {
            type: "boolean",
            description: "True if the sender is allowed to mail the recipient.",
          },
          reasonCode: {
            type: "string",
            description: "Stable reason code for the policy outcome.",
            enum: [
              "sender_allowed",
              "sender_blocked",
              "unknown_senders_disabled",
              "verification_required",
              "insufficient_postage",
              "policy_satisfied",
            ],
          },
          message: {
            type: "string",
            description: "Human-readable but non-authoritative explanation of the decision.",
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: { operationId: "getHealth", summary: "Read service health", "x-stability": "stable" },
    },
    "/protocol": {
      get: {
        operationId: "getProtocol",
        summary: "Discover protocol capabilities",
        "x-stability": "stable",
      },
    },
    "/openapi.json": {
      get: {
        operationId: "getOpenApi",
        summary: "Read this OpenAPI document",
        "x-stability": "stable",
      },
    },
    "/policies/{owner}": {
      get: {
        operationId: "getMailboxPolicy",
        summary: "Read mailbox policy",
        "x-stability": "stable",
      },
      put: {
        operationId: "replaceMailboxPolicy",
        summary: "Replace mailbox policy",
        security: signedRequestSecurity,
        "x-stability": "stable",
      },
    },
    "/policies/{owner}/senders/{sender}": {
      get: {
        operationId: "getSenderOverride",
        summary: "Read a sender override",
        "x-stability": "stable",
      },
      put: {
        operationId: "setSenderOverride",
        summary: "Set a sender override",
        security: signedRequestSecurity,
        "x-stability": "stable",
      },
      delete: {
        operationId: "resetSenderOverride",
        summary: "Reset a sender override",
        security: signedRequestSecurity,
        "x-stability": "stable",
      },
    },
    "/policies/evaluate": {
      post: {
        operationId: "evaluateMailboxPolicy",
        summary: "Evaluate whether a sender can mail a recipient",
        "x-stability": "stable",
        responses: {
          "200": {
            description: "Policy evaluation decision",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PolicyEvaluationDecision" },
              },
            },
          },
        },
      },
    },
    "/postage": {
      post: {
        operationId: "submitPostageProof",
        summary: "Submit a postage proof",
        security: signedRequestSecurity,
        "x-stability": "stable",
      },
    },
    "/postage/quote": {
      post: {
        operationId: "quotePostage",
        summary: "Quote recipient postage requirements",
        "x-stability": "stable",
      },
    },
    "/postage/{messageId}": {
      get: {
        operationId: "getPostageState",
        summary: "Read participant postage state",
        security: signedRequestSecurity,
        "x-stability": "stable",
      },
    },
    "/postage/{messageId}/settle": {
      post: {
        operationId: "settlePostage",
        summary: "Settle pending postage",
        security: signedRequestSecurity,
        "x-stability": "stable",
      },
    },
    "/postage/{messageId}/refund": {
      post: {
        operationId: "refundPostage",
        summary: "Mark pending postage for refund",
        security: signedRequestSecurity,
        "x-stability": "stable",
      },
    },
    "/receipts": {
      post: {
        operationId: "recordDelivery",
        summary: "Record message delivery",
        security: signedRequestSecurity,
        "x-stability": "stable",
      },
    },
    "/receipts/{messageId}": {
      get: {
        operationId: "getReceiptState",
        summary: "Read participant receipt state",
        security: signedRequestSecurity,
        "x-stability": "stable",
      },
    },
    "/receipts/{messageId}/read": {
      post: {
        operationId: "recordReadAcknowledgment",
        summary: "Record recipient read acknowledgment",
        security: signedRequestSecurity,
        "x-stability": "deprecated",
        deprecated: true,
        "x-deprecation": {
          reason: "Replaced by delivery-receipts streaming.",
          sunset: "2026-12-31",
          migration: "/receipts/{messageId}",
        },
      },
    },
  },
} as const;
