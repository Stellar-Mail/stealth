const fs = require("fs");

const code = fs.readFileSync("src/server/api/openapi.ts", "utf8");

const schemasToAdd = `
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
          meta: { $ref: "#/components/schemas/ApiMeta" },
        },
      },
      DomainError: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            description: "Stable domain error code.",
            example: "bad_request",
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
      ErrorEnvelope: {
        type: "object",
        required: ["error", "meta"],
        properties: {
          error: { $ref: "#/components/schemas/DomainError" },
          meta: { $ref: "#/components/schemas/ApiMeta" },
        },
      },
`;

let newCode = code.replace(/schemas: \{/, "schemas: {" + schemasToAdd);

const standardErrorResponses = `
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },`;

const emptySuccessResponse = `
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessEnvelope" },
              },
            },
          },`;

const replaceResponses = (match, p1, p2) => {
  if (p2.includes("responses:")) return match;

  let insert = `
        responses: {${emptySuccessResponse}${standardErrorResponses}
        },`;
  return `${p1}${insert}\n${p2}`;
};

// Replace generically for all except those that already have responses
newCode = newCode.replace(
  /(\s+(?:get|post|put|delete|patch):\s+\{[\s\S]*?(?:"x-stability"|deprecated|sunset|migration)[^\n]+,\n)(\s*\}(?:,|(?=\n)))/g,
  replaceResponses,
);

// Fix policies/evaluate
const evaluateOriginal = `"200": {
            description: "Policy evaluation decision",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PolicyEvaluationDecision" },
              },
            },
          },`;

const evaluateNew = `"200": {
            description: "Policy evaluation decision",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessEnvelope" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/PolicyEvaluationDecision" },
                      },
                    },
                  ],
                },
              },
            },
          },${standardErrorResponses}`;

newCode = newCode.replace(evaluateOriginal, evaluateNew);

fs.writeFileSync("src/server/api/openapi.ts", newCode);
console.log("updated openapi.ts");
