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
import { featureFlagSchema, type FeatureFlag } from "@/server/api/beta-controls/types";

const upsertFlagSchema = adminMutationSchema.extend({
  key: z.string().min(1).max(128),
  enabled: z.boolean(),
  accountAllow: z.array(z.string()).optional(),
  accountDeny: z.array(z.string()).optional(),
  percentage: z.number().int().min(0).max(100).nullable().optional(),
  description: z.string().max(500).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const Route = createFileRoute("/api/v1/admin/beta/flags/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);
          const flags = await getBetaControlService().listFlags();
          return apiSuccess(request, { flags });
        }),

      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = upsertFlagSchema.parse(body);
          const actor = context.principal!.address;

          const service = getBetaControlService();
          const existing = await service.getFlag(parsed.key);
          const now = new Date().toISOString();
          const flag: FeatureFlag = featureFlagSchema.parse({
            key: parsed.key,
            enabled: parsed.enabled,
            accountAllow: parsed.accountAllow ?? [],
            accountDeny: parsed.accountDeny ?? [],
            percentage: parsed.percentage ?? null,
            description: parsed.description ?? "",
            expiresAt: parsed.expiresAt ?? null,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            createdBy: actor,
            version: (existing?.version ?? 0) + 1,
          });

          const saved = await service.upsertFlag(flag);
          const supportId = recordAdminMutationAudit({
            actor,
            action: "beta.flag.upsert",
            target: `flag:${parsed.key}`,
            reason: parsed.reason,
            beforeState: existing ?? null,
            afterState: { key: saved.key, enabled: saved.enabled, version: saved.version },
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { flag: saved, supportId }, { status: 200 });
        }),

      DELETE: ({ request }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const url = new URL(request.url);
          const key = url.searchParams.get("key");
          if (!key)
            throw new (await import("@/server/api/errors")).ApiError(
              400,
              "bad_request",
              "Missing 'key' query parameter",
            );
          const actor = context.principal!.address;

          // The mandatory audit reason must come from the operator, not a fixed
          // string, so deletions are attributable. Reuse the same
          // adminMutationSchema the other mutation handlers enforce.
          const body = await request.json().catch(() => ({}));
          const parsed = adminMutationSchema.parse(body);

          const service = getBetaControlService();
          await service.deleteFlag(key, actor, context.requestId || "");

          const supportId = recordAdminMutationAudit({
            actor,
            action: "beta.flag.delete",
            target: `flag:${key}`,
            reason: parsed.reason,
            beforeState: { key },
            afterState: null,
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { deleted: true, key, supportId });
        }),
    },
  },
});
