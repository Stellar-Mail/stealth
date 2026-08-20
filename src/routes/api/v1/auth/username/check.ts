import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { validateUsername } from "@/features/identity/username";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const checkQuerySchema = z.object({
  username: z.string().optional(),
});

export const Route = createFileRoute("/api/v1/auth/username/check")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const url = new URL(request.url);
          const rawUsername = url.searchParams.get("username") ?? "";
          const apiContext = await getApiContext(request);

          const validation = validateUsername(rawUsername);

          if (!validation.valid) {
            return apiSuccess(request, {
              available: false,
              normalized: validation.normalized,
              canonicalEmail: validation.canonicalEmail ?? "",
              federationHandle: validation.federationHandle ?? "",
              reason: validation.reason,
              message: validation.message,
            });
          }

          const norm = validation.normalized;

          // Check if username is already bound to an account or live reservation
          const [existingUser, existingReservation] = await Promise.all([
            apiContext.repository.getUserByUsername(norm).catch(() => null),
            apiContext.repository.getUsernameReservation(norm).catch(() => null),
          ]);

          const now = Date.now();
          const isReserved =
            existingReservation && new Date(existingReservation.expiresAt).getTime() > now;

          if (existingUser || isReserved) {
            return apiSuccess(request, {
              available: false,
              normalized: norm,
              canonicalEmail: validation.canonicalEmail ?? "",
              federationHandle: validation.federationHandle ?? "",
              reason: "already_taken",
              message: "Username is already taken",
            });
          }

          return apiSuccess(request, {
            available: true,
            normalized: norm,
            canonicalEmail: validation.canonicalEmail ?? "",
            federationHandle: validation.federationHandle ?? "",
          });
        }),

      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const body = (await request.json().catch(() => ({}))) as { username?: string };
          const rawUsername = body.username ?? "";
          const apiContext = await getApiContext(request);

          const validation = validateUsername(rawUsername);

          if (!validation.valid) {
            return apiSuccess(request, {
              available: false,
              normalized: validation.normalized,
              canonicalEmail: validation.canonicalEmail ?? "",
              federationHandle: validation.federationHandle ?? "",
              reason: validation.reason,
              message: validation.message,
            });
          }

          const norm = validation.normalized;

          const [existingUser, existingReservation] = await Promise.all([
            apiContext.repository.getUserByUsername(norm).catch(() => null),
            apiContext.repository.getUsernameReservation(norm).catch(() => null),
          ]);

          const now = Date.now();
          const isReserved =
            existingReservation && new Date(existingReservation.expiresAt).getTime() > now;

          if (existingUser || isReserved) {
            return apiSuccess(request, {
              available: false,
              normalized: norm,
              canonicalEmail: validation.canonicalEmail ?? "",
              federationHandle: validation.federationHandle ?? "",
              reason: "already_taken",
              message: "Username is already taken",
            });
          }

          return apiSuccess(request, {
            available: true,
            normalized: norm,
            canonicalEmail: validation.canonicalEmail ?? "",
            federationHandle: validation.federationHandle ?? "",
          });
        }),
    },
  },
});
