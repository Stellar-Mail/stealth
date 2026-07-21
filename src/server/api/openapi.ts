const actorSecurity = [{ ActorHeader: [] }];

// ---------------------------------------------------------------------------
// Shared meta stub (fixed values so examples are deterministic and carry no
// real user data; a real response replaces these at runtime).
// ---------------------------------------------------------------------------
const EXAMPLE_META = {
  requestId: "00000000-0000-0000-0000-000000000000",
  timestamp: "2024-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Reusable error example payloads, grouped by domain family.
// Each value matches the runtime ErrorEnvelope shape produced by apiFailure().
// ---------------------------------------------------------------------------
const errorExamples = {
  // --- auth family ---
  AuthUnauthorized: {
    summary: "Missing or invalid actor header",
    value: {
      error: {
        code: "unauthorized",
        message: "Authentication required. Provide a valid x-stealth-address header.",
      },
      meta: EXAMPLE_META,
    },
  },
  AuthForbidden: {
    summary: "Authenticated actor lacks permission",
    value: {
      error: {
        code: "forbidden",
        message: "You do not have permission to modify this resource.",
      },
      meta: EXAMPLE_META,
    },
  },

  // --- validation family ---
  ValidationBadRequest: {
    summary: "Malformed request body or parameter",
    value: {
      error: {
        code: "bad_request",
        message: "Request body could not be parsed.",
      },
      meta: EXAMPLE_META,
    },
  },
  ValidationError: {
    summary: "Schema validation failure with field-level details",
    value: {
      error: {
        code: "validation_error",
        message: "Request validation failed",
        details: {
          validationErrors: [
            {
              path: "minimumPostage",
              rule: "format",
              message: "Expected a non-negative integer string",
            },
          ],
        },
      },
      meta: EXAMPLE_META,
    },
  },

  // --- conflict family ---
  ConflictDuplicate: {
    summary: "Resource already exists or idempotency key reused with different payload",
    value: {
      error: {
        code: "conflict",
        message: "A record for this message already exists.",
      },
      meta: EXAMPLE_META,
    },
  },

  // --- postage family ---
  PostageNotFound: {
    summary: "Postage record not found for the given message ID",
    value: {
      error: {
        code: "not_found",
        message: "No postage record found for this message.",
      },
      meta: EXAMPLE_META,
    },
  },
  PostageConflict: {
    summary: "Postage already settled or refunded",
    value: {
      error: {
        code: "conflict",
        message: "Postage for this message has already been settled.",
      },
      meta: EXAMPLE_META,
    },
  },

  // --- receipt family ---
  ReceiptNotFound: {
    summary: "Delivery receipt not found for the given message ID",
    value: {
      error: {
        code: "not_found",
        message: "No delivery receipt found for this message.",
      },
      meta: EXAMPLE_META,
    },
  },
  ReceiptConflict: {
    summary: "Delivery already recorded for this message",
    value: {
      error: {
        code: "conflict",
        message: "A delivery receipt for this message has already been recorded.",
      },
      meta: EXAMPLE_META,
    },
  },

  // --- policy family ---
  PolicyNotFound: {
    summary: "Mailbox policy not found for the given owner",
    value: {
      error: {
        code: "not_found",
        message: "No mailbox policy found for this owner.",
      },
      meta: EXAMPLE_META,
    },
  },
  PolicyForbidden: {
    summary: "Actor is not the policy owner",
    value: {
      error: {
        code: "forbidden",
        message: "Only the mailbox owner may modify this policy.",
      },
      meta: EXAMPLE_META,
    },
  },

  // --- rate-limit family ---
  RateLimitExceeded: {
    summary: "Too many requests from this actor",
    value: {
      error: {
        code: "too_many_requests",
        message: "Rate limit exceeded. Please slow down and retry after a short delay.",
      },
      meta: EXAMPLE_META,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Shorthand helpers for response blocks so paths stay readable.
// ---------------------------------------------------------------------------
function errorResponse(description: string, ...exampleKeys: (keyof typeof errorExamples)[]) {
  const examples: Record<string, unknown> = {};
  for (const key of exampleKeys) {
    examples[key] = { $ref: `#/components/examples/${key}` };
  }
  return {
    description,
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" }, examples },
    },
  };
}

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
      // Stable public validation error schema (issue #1519).
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
      // Matches the runtime ErrorEnvelope shape from response.ts / apiFailure().
      ErrorEnvelope: {
        type: "object",
        required: ["error", "meta"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {},
            },
          },
          meta: {
            type: "object",
            required: ["requestId", "timestamp"],
            properties: {
              requestId: { type: "string", format: "uuid" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    // Reusable error examples, one per domain family.
    examples: errorExamples,
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
        responses: {
          "404": errorResponse("Policy not found", "PolicyNotFound"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
      put: {
        operationId: "replaceMailboxPolicy",
        summary: "Replace mailbox policy",
        security: actorSecurity,
        "x-stability": "stable",
        responses: {
          "400": errorResponse("Bad request", "ValidationBadRequest"),
          "401": errorResponse("Unauthorized", "AuthUnauthorized"),
          "403": errorResponse("Forbidden", "AuthForbidden", "PolicyForbidden"),
          "422": errorResponse("Validation error", "ValidationError"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
    "/policies/{owner}/senders/{sender}": {
      get: {
        operationId: "getSenderOverride",
        summary: "Read a sender override",
        "x-stability": "stable",
        responses: {
          "404": errorResponse("Policy not found", "PolicyNotFound"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
      put: {
        operationId: "setSenderOverride",
        summary: "Set a sender override",
        security: actorSecurity,
        "x-stability": "stable",
        responses: {
          "400": errorResponse("Bad request", "ValidationBadRequest"),
          "401": errorResponse("Unauthorized", "AuthUnauthorized"),
          "403": errorResponse("Forbidden", "AuthForbidden", "PolicyForbidden"),
          "422": errorResponse("Validation error", "ValidationError"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
      delete: {
        operationId: "resetSenderOverride",
        summary: "Reset a sender override",
        security: actorSecurity,
        "x-stability": "stable",
        responses: {
          "401": errorResponse("Unauthorized", "AuthUnauthorized"),
          "403": errorResponse("Forbidden", "AuthForbidden", "PolicyForbidden"),
          "404": errorResponse("Override not found", "PolicyNotFound"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
    "/policies/evaluate": {
      post: {
        operationId: "evaluateMailboxPolicy",
        summary: "Evaluate whether a sender can mail a recipient",
        "x-stability": "stable",
        responses: {
          "400": errorResponse("Bad request", "ValidationBadRequest"),
          "422": errorResponse("Validation error", "ValidationError"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
    "/postage": {
      post: {
        operationId: "submitPostageProof",
        summary: "Submit a postage proof",
        security: actorSecurity,
        "x-stability": "stable",
        responses: {
          "400": errorResponse("Bad request", "ValidationBadRequest"),
          "401": errorResponse("Unauthorized", "AuthUnauthorized"),
          "403": errorResponse("Forbidden", "AuthForbidden"),
          "409": errorResponse("Postage already recorded", "PostageConflict"),
          "422": errorResponse("Validation error", "ValidationError"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
    "/postage/quote": {
      post: {
        operationId: "quotePostage",
        summary: "Quote recipient postage requirements",
        "x-stability": "stable",
        responses: {
          "400": errorResponse("Bad request", "ValidationBadRequest"),
          "404": errorResponse("Recipient policy not found", "PostageNotFound"),
          "422": errorResponse("Validation error", "ValidationError"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
    "/postage/{messageId}": {
      get: {
        operationId: "getPostageState",
        summary: "Read participant postage state",
        security: actorSecurity,
        "x-stability": "stable",
        responses: {
          "401": errorResponse("Unauthorized", "AuthUnauthorized"),
          "403": errorResponse("Forbidden", "AuthForbidden"),
          "404": errorResponse("Postage record not found", "PostageNotFound"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
    "/postage/{messageId}/settle": {
      post: {
        operationId: "settlePostage",
        summary: "Settle pending postage",
        security: actorSecurity,
        "x-stability": "stable",
        responses: {
          "401": errorResponse("Unauthorized", "AuthUnauthorized"),
          "403": errorResponse("Forbidden", "AuthForbidden"),
          "404": errorResponse("Postage not found", "PostageNotFound"),
          "409": errorResponse("Postage already settled or refunded", "PostageConflict"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
    "/postage/{messageId}/refund": {
      post: {
        operationId: "refundPostage",
        summary: "Mark pending postage for refund",
        security: actorSecurity,
        "x-stability": "stable",
        responses: {
          "401": errorResponse("Unauthorized", "AuthUnauthorized"),
          "403": errorResponse("Forbidden", "AuthForbidden"),
          "404": errorResponse("Postage not found", "PostageNotFound"),
          "409": errorResponse("Postage already settled or refunded", "PostageConflict"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
    "/receipts": {
      post: {
        operationId: "recordDelivery",
        summary: "Record message delivery",
        security: actorSecurity,
        "x-stability": "stable",
        responses: {
          "400": errorResponse("Bad request", "ValidationBadRequest"),
          "401": errorResponse("Unauthorized", "AuthUnauthorized"),
          "403": errorResponse("Forbidden", "AuthForbidden"),
          "409": errorResponse("Delivery already recorded", "ReceiptConflict"),
          "422": errorResponse("Validation error", "ValidationError"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
    "/receipts/{messageId}": {
      get: {
        operationId: "getReceiptState",
        summary: "Read participant receipt state",
        security: actorSecurity,
        "x-stability": "stable",
        responses: {
          "401": errorResponse("Unauthorized", "AuthUnauthorized"),
          "403": errorResponse("Forbidden", "AuthForbidden"),
          "404": errorResponse("Receipt not found", "ReceiptNotFound"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
    "/receipts/{messageId}/read": {
      post: {
        operationId: "recordReadAcknowledgment",
        summary: "Record recipient read acknowledgment",
        security: actorSecurity,
        "x-stability": "deprecated",
        deprecated: true,
        "x-deprecation": {
          reason: "Replaced by delivery-receipts streaming.",
          sunset: "2026-12-31",
          migration: "/receipts/{messageId}",
        },
        responses: {
          "401": errorResponse("Unauthorized", "AuthUnauthorized"),
          "403": errorResponse("Forbidden", "AuthForbidden"),
          "404": errorResponse("Receipt not found", "ReceiptNotFound"),
          "409": errorResponse("Already acknowledged", "ReceiptConflict"),
          "429": errorResponse("Rate limit exceeded", "RateLimitExceeded"),
        },
      },
    },
  },
} as const;
