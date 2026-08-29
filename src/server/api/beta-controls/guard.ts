import { ApiError } from "../errors";
import type { BetaCapability } from "./types";
import { getBetaControlService } from "./index";

export interface EnforceOptions {
  actor?: string;
  requestId?: string;
}

/**
 * Enforce a beta kill switch for a capability. Throws ApiError(503,
 * "beta_capability_disabled") when the switch is closed. Evaluation is
 * fail-closed: any error resolving the control disables the capability.
 */
export async function enforceCapability(
  capability: BetaCapability,
  _opts: EnforceOptions = {},
): Promise<void> {
  const service = getBetaControlService();
  const evaluation = await service.evaluateKillSwitch(capability);
  if (!evaluation.enabled) {
    throw new ApiError(
      503,
      "beta_capability_disabled",
      `Beta capability '${capability}' is temporarily disabled by an operator.`,
      {
        capability,
        source: evaluation.source,
        retryAfterSeconds: 60,
      },
    );
  }
}
