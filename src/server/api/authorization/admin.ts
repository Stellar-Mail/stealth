import { z } from "zod";
import { parseSessionCookie, validateSession } from "../auth/session-service";
import type { ApiContext } from "../context";
import { ApiError } from "../errors";
import { recordAuditEvent } from "../audit";
import { maskEmail } from "@/features/identity/registration";

// Maximum allowed age for an active admin session before requiring fresh authentication
export const ADMIN_SESSION_MAX_AGE_SECONDS = 15 * 60; // 15 minutes for "recent authentication"

export function getAdminAddresses(): string[] {
  const envAdmins =
    typeof process !== "undefined" ? process.env.STEALTH_ADMIN_ADDRESSES : undefined;
  if (envAdmins) {
    return envAdmins.split(",").map((a) => a.trim().toUpperCase());
  }
  // Fallback to a default mock admin address in non-production environments
  if (!import.meta.env.PROD) {
    return ["GADMIN77777777777777777777777777777777777777777777777777"];
  }
  return [];
}

export async function requireAdminRole(context: ApiContext, request: Request): Promise<void> {
  if (!context.isAuthenticated || !context.principal) {
    throw new ApiError(401, "unauthorized", "Authentication required");
  }

  const actorAddress = context.principal.address.toUpperCase();
  const admins = getAdminAddresses();

  if (!admins.includes(actorAddress)) {
    throw new ApiError(403, "forbidden", "Administrator privileges required");
  }

  // Require recent authentication (within 15 minutes) if session cookie is present
  const cookieHeader = request.headers.get("cookie");
  const sessionId = parseSessionCookie(cookieHeader);
  if (sessionId) {
    const activeSession = await validateSession(context, sessionId);
    if (!activeSession) {
      throw new ApiError(401, "unauthorized", "Invalid or expired session");
    }
    const sessionCreatedAt = new Date(activeSession.session.createdAt).getTime();
    const ageSeconds = (Date.now() - sessionCreatedAt) / 1000;
    if (ageSeconds > ADMIN_SESSION_MAX_AGE_SECONDS) {
      throw new ApiError(
        401,
        "recent_auth_required",
        "Recent authentication required (session older than 15 minutes)",
      );
    }
  }
}

export const adminMutationSchema = z.object({
  reason: z.string().min(4, "Reason must be at least 4 characters").max(500, "Reason is too long"),
});

export function maskUserData<T>(data: T): T {
  if (!data || typeof data !== "object") return data;
  const copy = JSON.parse(JSON.stringify(data));

  const mask = (obj: any) => {
    for (const key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        mask(obj[key]);
      } else if (typeof obj[key] === "string") {
        const lowerKey = key.toLowerCase();
        if (lowerKey === "email") {
          obj[key] = maskEmail(obj[key]);
        } else if (
          lowerKey.includes("password") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("key") ||
          lowerKey.includes("token") ||
          lowerKey.includes("salt") ||
          lowerKey.includes("seed")
        ) {
          obj[key] = "●●●●●●●●";
        }
      }
    }
  };

  mask(copy);
  return copy;
}

export function recordAdminMutationAudit(params: {
  actor: string;
  action: string;
  target: string;
  reason: string;
  beforeState: any;
  afterState: any;
  requestId: string;
  result: "success" | "denied";
}) {
  const supportId = `sup_${crypto.randomUUID().replace(/-/g, "")}`;
  const beforeMasked = maskUserData(params.beforeState);
  const afterMasked = maskUserData(params.afterState);

  console.info(
    JSON.stringify({
      _audit: true,
      type: "admin_mutation",
      actor: params.actor,
      action: params.action,
      target: params.target,
      reason: params.reason,
      beforeState: beforeMasked,
      afterState: afterMasked,
      supportId,
      requestId: params.requestId,
      result: params.result,
      timestamp: new Date().toISOString(),
    }),
  );

  recordAuditEvent({
    actor: params.actor,
    action: params.action,
    targetType: "admin_mutation",
    safeTargetReference: params.target,
    result: params.result,
    requestId: params.requestId,
  });

  return supportId;
}
