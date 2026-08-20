// ---------------------------------------------------------------------------
// BETA-069 (Issue #1976) — Account Profile API
//
// GET  /api/v1/accounts/profile  → Returns authenticated user's profile +
//                                  account info composite.
// PATCH /api/v1/accounts/profile → Updates mutable profile fields with
//                                  optimistic concurrency.
// ---------------------------------------------------------------------------

import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { profileUpdateSchema } from "@/server/api/domain";
import { getAccountProfile, updateAccountProfile } from "@/server/api/account-settings-service";

export const Route = createFileRoute("/api/v1/accounts/profile")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const requestId = context.requestId ?? crypto.randomUUID();

          const result = await getAccountProfile(context.repository, actor, requestId);

          return apiSuccess(request, result);
        }),

      PATCH: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const requestId = context.requestId ?? crypto.randomUUID();

          const body = await parseJsonBody(request, profileUpdateSchema, {
            route: "PATCH /accounts/profile",
          });

          // Extract session authentication time for the recent-auth gate.
          // The principal's authenticatedAt is set when the session was
          // validated, which gives us the time of the most recent auth check.
          const sessionAuthenticatedAt = context.isAuthenticated
            ? context.principal.authenticatedAt
            : undefined;

          const result = await updateAccountProfile(
            context.repository,
            actor,
            body,
            requestId,
            sessionAuthenticatedAt,
          );

          return apiSuccess(request, result);
        }),
    },
  },
});
