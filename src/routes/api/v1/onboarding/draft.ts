import { createFileRoute } from "@tanstack/react-router";

import { getApiContext } from "@/server/api/context";
import {
  getOnboardingDraft,
  onboardingDraftSaveSchema,
  resolveSessionUser,
  saveOnboardingDraft,
} from "@/server/api/onboarding-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/onboarding/draft")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const user = await resolveSessionUser(context.repository, request.headers.get("cookie"));
          const draft = await getOnboardingDraft(context.repository, user.userId);
          // Safe projection: never exposes credentials, wallet seeds, or hashes.
          return apiSuccess(request, { draft });
        }),

      PUT: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const user = await resolveSessionUser(context.repository, request.headers.get("cookie"));
          const input = await parseJsonBody(request, onboardingDraftSaveSchema, {
            route: "PUT /api/v1/onboarding/draft",
          });
          const saved = await saveOnboardingDraft(context.repository, user.userId, input);
          return apiSuccess(request, { draft: saved });
        }),
    },
  },
});
