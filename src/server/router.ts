import express, { type Router } from "express";

import type { ApiRepository } from "@/server/api/repository";
import { attachRelayDiagnosticsRoute } from "@/server/routes/relayDiagnostics";

type RelayDiagnosticsRepository = ApiRepository & {
  getRelayOwner(relayId: string): Promise<string | null>;
};

export function createRouter(repository: RelayDiagnosticsRepository): Router {
  const router = express.Router();
  attachRelayDiagnosticsRoute(router, repository);
  return router;
}
