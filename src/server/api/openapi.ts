import { z, type ZodTypeAny } from "zod";

import {
  hash32Schema,
  mailboxPolicySchema,
  policyEvaluationRequestSchema,
  postageSchema,
  postageSubmissionSchema,
  stellarAddressSchema,
  stroopAmountSchema,
} from "./domain";

const signedRequestSecurity = [{ StellarSignedRequest: [] }];

const sharedSchemaDefinitions = [
  ["StellarAddress", stellarAddressSchema],
  ["Hash32", hash32Schema],
  ["StroopAmount", stroopAmountSchema],
  ["MailboxPolicy", mailboxPolicySchema],
  ["PolicyEvaluationRequest", policyEvaluationRequestSchema],
  ["PostageSubmission", postageSubmissionSchema],
  ["Postage", postageSchema],
] as const;

function isSchemaReferenceCandidate(
  schema: ZodTypeAny,
  sharedSchemaMap: Map<ZodTypeAny, string>,
  skipSchema?: ZodTypeAny,
) {
  return skipSchema !== schema && sharedSchemaMap.has(schema);
}

function convertStringSchema(schema: ZodTypeAny): Record<string, unknown> {
  const def = schema._def as { checks?: Array<{ kind: string; regex?: RegExp; value?: number }> };
  const out: Record<string, unknown> = { type: "string" };
  for (const check of def.checks ?? []) {
    switch (check.kind) {
      case "regex":
        out.pattern = check.regex?.source;
        break;
      case "min":
        out.minLength = check.value;
        break;
      case "max":
        out.maxLength = check.value;
        break;
      case "email":
        out.format = "email";
        break;
      case "url":
        out.format = "uri";
        break;
      case "uuid":
        out.format = "uuid";
        break;
      case "datetime":
        out.format = "date-time";
        break;
      default:
        break;
    }
  }
  return out;
}

export function toOpenApiSchema(
  schema: ZodTypeAny,
  sharedSchemaMap: Map<ZodTypeAny, string> = new Map(),
  skipSchema?: ZodTypeAny,
): Record<string, unknown> {
  if (isSchemaReferenceCandidate(schema, sharedSchemaMap, skipSchema)) {
    const name = sharedSchemaMap.get(schema);
    return { $ref: `#/components/schemas/${name}` };
  }

  const def = schema._def as Record<string, unknown> & { typeName?: string };
  switch (def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodString: {
      return convertStringSchema(schema);
    }
    case z.ZodFirstPartyTypeKind.ZodNumber: {
      return { type: "number" };
    }
    case z.ZodFirstPartyTypeKind.ZodBoolean: {
      return { type: "boolean" };
    }
    case z.ZodFirstPartyTypeKind.ZodEnum: {
      return {
        type: "string",
        enum: (def.values as unknown[]).slice(),
      };
    }
    case z.ZodFirstPartyTypeKind.ZodLiteral: {
      const value = def.value as unknown;
      return { enum: [value] };
    }
    case z.ZodFirstPartyTypeKind.ZodOptional:
    case z.ZodFirstPartyTypeKind.ZodNullable:
    case z.ZodFirstPartyTypeKind.ZodDefault: {
      return toOpenApiSchema(def.innerType as ZodTypeAny, sharedSchemaMap, skipSchema);
    }
    case z.ZodFirstPartyTypeKind.ZodEffects: {
      const effectType = (def as { effect?: { type?: string } }).effect?.type;
      if (effectType === "transform" || effectType === "preprocess") {
        throw new Error(`Unsupported Zod construct: ${effectType}`);
      }
      const innerType = (def as { schema?: ZodTypeAny }).schema ?? (def as { innerType?: ZodTypeAny }).innerType;
      if (!innerType) {
        throw new Error(`Unsupported Zod construct: ${def.typeName ?? "unknown"}`);
      }
      return toOpenApiSchema(innerType, sharedSchemaMap, skipSchema);
    }
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = (schema as z.ZodObject<any>).shape;
      const properties: Record<string, Record<string, unknown>> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        const propertySchema = toOpenApiSchema(value as ZodTypeAny, sharedSchemaMap, skipSchema);
        properties[key] = propertySchema;
        if (!(value as ZodTypeAny).isOptional()) {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        required,
      };
    }
    case z.ZodFirstPartyTypeKind.ZodArray: {
      return {
        type: "array",
        items: toOpenApiSchema(def.type as ZodTypeAny, sharedSchemaMap, skipSchema),
      };
    }
    default: {
      throw new Error(`Unsupported Zod construct: ${def.typeName ?? "unknown"}`);
    }
  }
}

const sharedSchemaMap = new Map(sharedSchemaDefinitions.map(([name, schema]) => [schema, name]));

const baseComponentSchemas = {
  StellarAddress: toOpenApiSchema(stellarAddressSchema, sharedSchemaMap, stellarAddressSchema),
  Hash32: toOpenApiSchema(hash32Schema, sharedSchemaMap, hash32Schema),
  StroopAmount: toOpenApiSchema(stroopAmountSchema, sharedSchemaMap, stroopAmountSchema),
  MailboxPolicy: toOpenApiSchema(mailboxPolicySchema, sharedSchemaMap, mailboxPolicySchema),
  PolicyEvaluationRequest: toOpenApiSchema(
    policyEvaluationRequestSchema,
    sharedSchemaMap,
    policyEvaluationRequestSchema,
  ),
  PostageSubmission: toOpenApiSchema(postageSubmissionSchema, sharedSchemaMap, postageSubmissionSchema),
  Postage: toOpenApiSchema(postageSchema, sharedSchemaMap, postageSchema),
};

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
      ...baseComponentSchemas,
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
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PolicyEvaluationRequest" },
            },
          },
        },
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
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PostageSubmission" },
            },
          },
        },
        responses: {
          "201": {
            description: "Postage proof accepted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Postage" },
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
