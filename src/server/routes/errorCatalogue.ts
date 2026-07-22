import type { Router } from "express";
import { getErrorCatalogue } from "@/server/api/errors";

/** Attach the error‑catalogue route to the router. */
export function attachErrorCatalogueRoute(router: Router): void {
  router.get("/errors", getErrorCatalogue);
}
