import type { Request, Response, Router } from "express";

import type { ApiRepository } from "@/server/api/repository";
import { getRelayDiagnosticsResponse } from "@/server/api/relay-diagnostics-service";

type RelayDiagnosticsRepository = ApiRepository & {
  getRelayOwner(relayId: string): Promise<string | null>;
};

type RelayDiagnosticsRequest = Request & {
  params: {
    relayId: string;
  };
};

export interface AuthenticatedRequest extends RelayDiagnosticsRequest {
  user: {
    id: string;
  };
}

export async function relayDiagnosticsHandler(
  req: AuthenticatedRequest,
  res: Response,
  repository: RelayDiagnosticsRepository,
) {
  try {
    const relayId = req.params.relayId;
    const ownerId = await repository.getRelayOwner(relayId);

    if (ownerId === null) {
      return res.status(404).json({
        error: "relay_not_found",
        message: "Diagnostic report unavailable: Relay not found.",
      });
    }

    if (ownerId !== req.user.id) {
      return res.status(403).json({
        error: "forbidden",
        message: "Diagnostic report unavailable: You do not have permission to view this relay.",
      });
    }

    const diagnostics = await getRelayDiagnosticsResponse(repository, relayId);
    return res.status(200).json(diagnostics);
  } catch {
    return res.status(500).json({
      error: "diagnostics_unavailable",
      message: "Diagnostic report unavailable: Server error occurred.",
    });
  }
}

export function attachRelayDiagnosticsRoute(
  router: Router,
  repository: RelayDiagnosticsRepository,
) {
  router.get("/relays/:relayId/diagnostics", (req, res) => {
    void relayDiagnosticsHandler(req as AuthenticatedRequest, res, repository);
  });
}
