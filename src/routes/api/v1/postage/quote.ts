import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import { quotePostage } from "@/server/api/postage-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const quoteSchema = z.object({
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
});

function parseQuoteParams(request: Request) {
  const url = new URL(request.url);
  return quoteSchema.parse({
    recipient: url.searchParams.get("recipient") ?? "",
    sender: url.searchParams.get("sender") ?? "",
  });
}

export const Route = createFileRoute("/api/v1/postage/quote")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const input = parseQuoteParams(request);
          const quote = await quotePostage(getApiContext().repository, input);
          return apiSuccess(request, quote);
        }),
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const input = await parseJsonBody(request, quoteSchema);
          const quote = await quotePostage(getApiContext().repository, input);
          return apiSuccess(request, quote);
        }),
    },
  },
});
