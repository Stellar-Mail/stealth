import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  requireAdminRole,
  recordAdminMutationAudit,
  adminMutationSchema,
} from "@/server/api/authorization/admin";
import { getBetaControlService, initBetaControlService } from "@/server/api/beta-controls";
import { cohortSchema, type Cohort } from "@/server/api/beta-controls/types";

const updateCohortSchema = adminMutationSchema.extend({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(500).optional(),
  inviteLimit: z.number().int().nonnegative().optional(),
  memberAccounts: z.array(z.string()).optional(),
  featureFlags: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const Route = createFileRoute("/api/v1/admin/beta/cohorts/$cohortId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);
          const cohort = await getBetaControlService().getCohort(params.cohortId);
          if (!cohort)
            throw new ApiError(404, "not_found", `Cohort '${params.cohortId}' not found`);
          return apiSuccess(request, { cohort });
        }),

      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = updateCohortSchema.parse(body);
          const actor = context.principal!.address;

          const service = getBetaControlService();
          const existing = await service.getCohort(params.cohortId);
          if (!existing)
            throw new ApiError(404, "not_found", `Cohort '${params.cohortId}' not found`);

          const now = new Date().toISOString();
          const updated: Cohort = cohortSchema.parse({
            ...existing,
            name: parsed.name ?? existing.name,
            description: parsed.description ?? existing.description,
            inviteLimit: parsed.inviteLimit ?? existing.inviteLimit,
            memberAccounts: parsed.memberAccounts ?? existing.memberAccounts,
            featureFlags: parsed.featureFlags ?? existing.featureFlags,
            expiresAt: parsed.expiresAt !== undefined ? parsed.expiresAt : existing.expiresAt,
            updatedAt: now,
            createdBy: existing.createdBy,
            version: existing.version + 1,
          });

          // The expected-version check is performed inside the store's
          // serialized mutation so a concurrent PUT cannot win a lost update.
          const saved = await service.upsertCohort(updated, {
            expectedVersion: parsed.expectedVersion,
          });
          const supportId = recordAdminMutationAudit({
            actor,
            action: "beta.cohort.update",
            target: `cohort:${saved.id}`,
            reason: parsed.reason,
            beforeState: { id: existing.id, version: existing.version },
            afterState: { id: saved.id, version: saved.version },
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { cohort: saved, supportId });
        }),

      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);
          const actor = context.principal!.address;

          const service = getBetaControlService();
          const existing = await service.getCohort(params.cohortId);
          if (!existing)
            throw new ApiError(404, "not_found", `Cohort '${params.cohortId}' not found`);

          // The mandatory audit reason must come from the operator, not a fixed
          // string, so deletions are attributable.
          const deleteBody = await request.json().catch(() => ({}));
          const deleteParsed = adminMutationSchema.parse(deleteBody);

          await service.deleteCohort(params.cohortId, actor, context.requestId || "");
          const supportId = recordAdminMutationAudit({
            actor,
            action: "beta.cohort.delete",
            target: `cohort:${params.cohortId}`,
            reason: deleteParsed.reason,
            beforeState: { id: params.cohortId },
            afterState: null,
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { deleted: true, id: params.cohortId, supportId });
        }),
    },
  },
});
