import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import { quotePostage } from "@/server/api/postage-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

/**
 * Postage quote request schema with strict validation for Stellar addresses.
 *
 * ## Validation Rules
 *
 * Both `recipient` and `sender` must be valid Stellar G-addresses:
 * - Must start with 'G'
 * - Must be exactly 56 characters long
 * - Must contain only valid base32 characters (A-Z, 2-7)
 * - Whitespace is trimmed automatically
 * - Lowercase letters are normalized to uppercase
 *
 * ## Error Responses
 *
 * Invalid addresses return 422 validation_error with details:
 * ```json
 * {
 *   "error": {
 *     "code": "validation_error",
 *     "message": "Request validation failed",
 *     "details": {
 *       "fieldErrors": {
 *         "recipient": ["Expected a Stellar G-address"]
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * ## Boundary Cases Handled
 *
 * - Empty strings: rejected
 * - Whitespace-only: rejected after trim
 * - Wrong length (< 56 or > 56): rejected
 * - Invalid prefix (not 'G'): rejected
 * - Invalid base32 characters (0, 1, 8, 9, special chars): rejected
 * - Null/undefined: rejected
 * - Non-string types: rejected
 * - Oversized strings (>> 56 chars): rejected
 *
 * @example Valid request
 * ```json
 * {
 *   "recipient": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
 *   "sender": "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
 * }
 * ```
 */
const quoteSchema = z.object({
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
});

export const Route = createFileRoute("/api/v1/postage/quote")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const input = await parseJsonBody(request, quoteSchema);
          const quote = await quotePostage((await getApiContext()).repository, input);
          return apiSuccess(request, quote);
        }),
    },
  },
});
