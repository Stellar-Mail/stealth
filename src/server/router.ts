import express, { type Router } from "express";
import { attachErrorCatalogueRoute } from "@/server/routes/errorCatalogue";

import type { ApiRepository } from "@/server/api/repository";
import { attachRelayDiagnosticsRoute } from "@/server/routes/relayDiagnostics";

type RelayDiagnosticsRepository = ApiRepository & {
  getRelayOwner(relayId: string): Promise<string | null>;
};

export function createRouter(repository: RelayDiagnosticsRepository): Router {
  const router = express.Router();
  attachRelayDiagnosticsRoute(router, repository);
  // New public endpoint exposing the error catalogue.
  attachErrorCatalogueRoute(router);
  return router;
}
