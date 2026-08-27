import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import {
  getPolicyReconciliation,
  type PolicyReconciliationChainState,
} from "@/server/api/policy-service";
import { parseSearchParams } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { getPolicyChainClient, contractPolicyToApi } from "@/services/stellar/policy-chain-client";

const reconciliationQuerySchema = z.object({
  /**
   * Explicit override for the on-chain policy version. When absent the route
   * reads the authoritative state from the deployed Policies contract via
   * the chain client.
   */
  chainVersion: z.coerce.number().int().min(0).optional(),
});

/**
 * Reads the authoritative on-chain policy state via the policy chain client.
 * Returns null when the chain client is unavailable or the read fails, so
 * the caller can fall back to intent-only reconciliation.
 */
async function readChainState(owner: string): Promise<PolicyReconciliationChainState | null> {
  try {
    const chainClient = getPolicyChainClient();
    const versioned = await chainClient.readVersionedPolicy(owner);
    if (!versioned) return null;
    return {
      policy: contractPolicyToApi(versioned.policy),
      version: versioned.version,
      // The contract carries require_receipt as a fourth boolean that
      // contractPolicyToApi strips; pass it through so reconciliation can
      // detect receipt-policy drift.
      requireReceipt: versioned.policy.require_receipt,
    };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/v1/policies/$owner/reconciliation")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const query = parseSearchParams(request, reconciliationQuerySchema);

          let chain: PolicyReconciliationChainState = {};

          if (query.chainVersion !== undefined) {
            // Explicit override takes precedence.
            chain = { version: query.chainVersion };
          } else {
            // Read authoritative on-chain state via the deployed contract.
            const onChain = await readChainState(owner);
            if (onChain) {
              chain = onChain;
            }
          }

          const result = await getPolicyReconciliation(context.repository, owner, chain);
          return apiSuccess(request, result);
        }),
    },
  },
});
