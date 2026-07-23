import { API_ERROR_CODES, API_ERROR_REGISTRY } from "./errors";

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Stealth Mail API",
    version: "1.0.0",
    description:
      "Development API for mailbox policy, Stellar postage proofs, and delivery receipts.",
  },
  servers: [
    {
      url: "/api/v1",
    },
  ],
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
      ApiMeta: {
        type: "object",
        required: ["requestId", "timestamp"],
        properties: {
          requestId: {
            type: "string",
            description: "Unique request identifier for tracing.",
          },
          timestamp: {
            type: "string",
            format: "date-time",
            description: "Server timestamp of the response.",
          },
        },
      },
      SuccessEnvelope: {
        type: "object",
        required: ["data", "meta"],
        properties: {
          data: {
            type: "object",
            description: "Operation-specific response payload.",
          },
          meta: {
            $ref: "#/components/schemas/ApiMeta",
          },
        },
      },
      DomainError: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            description: "Stable domain error code.",
            enum: API_ERROR_CODES,
            example: "invalid_state_transition",
          },
          message: {
            type: "string",
            description: "Human-readable explanation of the error.",
          },
          details: {
            description: "Optional structured error details.",
          },
        },
      },
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
          allowUnknown: {
            type: "boolean",
          },
          minimumPostage: {
            $ref: "#/components/schemas/StroopAmount",
          },
          requireVerified: {
            type: "boolean",
          },
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
            items: {
              $ref: "#/components/schemas/ValidationErrorItem",
            },
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
      RetryClassification: {
        type: "string",
        enum: ["permanent", "transient", "rate_limit", "conflict"],
        description: "Stable machine-readable classification of retry eligibility.",
      },
      ErrorEnvelope: {
        type: "object",
        required: ["error", "meta"],
        additionalProperties: false,
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "retryable", "retryClassification"],
            additionalProperties: false,
            properties: {
              code: {
                type: "string",
                description: "Stable domain-specific error code.",
                enum: API_ERROR_CODES,
              },
              message: {
                type: "string",
                description: "Human-readable explanation of the error.",
              },
              retryable: {
                type: "boolean",
                description: "Indicates whether the request can be retried.",
              },
              retryClassification: {
                $ref: "#/components/schemas/RetryClassification",
              },
              retryAfter: {
                type: "integer",
                description: "Optional delay in seconds before retrying the request.",
              },
              details: {
                type: "object",
                description: "Structured contextual error details.",
              },
            },
          },
          meta: {
            type: "object",
            required: ["requestId", "timestamp"],
            additionalProperties: false,
            properties: {
              requestId: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
      ApiErrorRegistry: {
        type: "object",
        description:
          "Stable error-code metadata. This schema is generated from the runtime registry.",
        "x-error-registry": API_ERROR_REGISTRY,
      },
    },
  },
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        summary: "Read service health",
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/protocol": {
      get: {
        operationId: "getProtocol",
        summary: "Discover protocol capabilities",
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/openapi.json": {
      get: {
        operationId: "getOpenApi",
        summary: "Read this OpenAPI document",
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/policies/{owner}": {
      get: {
        operationId: "getMailboxPolicy",
        summary: "Read mailbox policy",
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
      put: {
        operationId: "replaceMailboxPolicy",
        summary: "Replace mailbox policy",
        "x-max-body-bytes": 64 * 1024,
        security: [
          {
            StellarSignedRequest: [],
          },
        ],
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/policies/{owner}/senders/{sender}": {
      get: {
        operationId: "getSenderOverride",
        summary: "Read a sender override",
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
      put: {
        operationId: "setSenderOverride",
        "x-max-body-bytes": 64 * 1024,
        summary: "Set a sender override",
        security: [
          {
            StellarSignedRequest: [],
          },
        ],
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
      delete: {
        operationId: "resetSenderOverride",
        summary: "Reset a sender override",
        security: [
          {
            StellarSignedRequest: [],
          },
        ],
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/policies/evaluate": {
      post: {
        operationId: "evaluateMailboxPolicy",
        "x-max-body-bytes": 16 * 1024,
        summary: "Evaluate whether a sender can mail a recipient",
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Policy evaluation decision",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    {
                      $ref: "#/components/schemas/SuccessEnvelope",
                    },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/PolicyEvaluationDecision",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
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
        "x-max-body-bytes": 16 * 1024,
        security: [
          {
            StellarSignedRequest: [],
          },
        ],
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/postage/quote": {
      post: {
        operationId: "quotePostage",
        summary: "Quote recipient postage requirements",
        "x-max-body-bytes": 16 * 1024,
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/postage/{messageId}": {
      get: {
        operationId: "getPostageState",
        summary: "Read participant postage state",
        security: [
          {
            StellarSignedRequest: [],
          },
        ],
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/postage/{messageId}/settle": {
      post: {
        operationId: "settlePostage",
        summary: "Settle pending postage",
        security: [
          {
            StellarSignedRequest: [],
          },
        ],
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/postage/{messageId}/refund": {
      post: {
        operationId: "refundPostage",
        summary: "Mark pending postage for refund",
        security: [
          {
            StellarSignedRequest: [],
          },
        ],
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/receipts": {
      post: {
        operationId: "recordDelivery",
        "x-max-body-bytes": 16 * 1024,
        summary: "Record message delivery",
        security: [
          {
            StellarSignedRequest: [],
          },
        ],
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/receipts/{messageId}": {
      get: {
        operationId: "getReceiptState",
        summary: "Read participant receipt state",
        security: [
          {
            StellarSignedRequest: [],
          },
        ],
        "x-stability": "stable",
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
    "/receipts/{messageId}/read": {
      post: {
        operationId: "recordReadAcknowledgment",
        summary: "Record recipient read acknowledgment",
        security: [
          {
            StellarSignedRequest: [],
          },
        ],
        "x-stability": "deprecated",
        deprecated: true,
        "x-deprecation": {
          reason: "Replaced by delivery-receipts streaming.",
          sunset: "2026-12-31",
          migration: "/receipts/{messageId}",
        },
        responses: {
          default: { description: "" },
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessEnvelope",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
