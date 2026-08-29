import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  requireAdminRole,
  recordAdminMutationAudit,
  adminMutationSchema,
} from "@/server/api/authorization/admin";
import { getBetaControlService, initBetaControlService } from "@/server/api/beta-controls";
import { cohortSchema, type Cohort } from "@/server/api/beta-controls/types";

const createCohortSchema = adminMutationSchema.extend({
  id: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(128),
  description: z.string().max(500).optional(),
  inviteLimit: z.number().int().nonnegative().optional(),
  memberAccounts: z.array(z.string()).optional(),
  featureFlags: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

function genCohortId() {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `cohort_${rand}`;
}

export const Route = createFileRoute("/api/v1/admin/beta/cohorts/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);
          const cohorts = await getBetaControlService().listCohorts();
          return apiSuccess(request, { cohorts });
        }),

      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = createCohortSchema.parse(body);
          const actor = context.principal!.address;
          const now = new Date().toISOString();

          const cohort: Cohort = cohortSchema.parse({
            id: parsed.id ?? genCohortId(),
            name: parsed.name,
            description: parsed.description ?? "",
            inviteLimit: parsed.inviteLimit ?? 0,
            memberAccounts: parsed.memberAccounts ?? [],
            featureFlags: parsed.featureFlags ?? [],
            expiresAt: parsed.expiresAt ?? null,
            createdAt: now,
            updatedAt: now,
            createdBy: actor,
            version: 1,
          });

          const saved = await getBetaControlService().upsertCohort(cohort);
          const supportId = recordAdminMutationAudit({
            actor,
            action: "beta.cohort.create",
            target: `cohort:${saved.id}`,
            reason: parsed.reason,
            beforeState: null,
            afterState: { id: saved.id, name: saved.name, version: saved.version },
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { cohort: saved, supportId }, { status: 200 });
        }),
    },
  },
});
