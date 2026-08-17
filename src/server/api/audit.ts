import { z } from "zod";

export const auditEventResultSchema = z.enum(["success", "denied"]);
export type AuditEventResult = z.infer<typeof auditEventResultSchema>;

export const auditEventSchema = z.object({
  actor: z.string(),
  action: z.string(),
  targetType: z.string(),
  safeTargetReference: z.string(),
  result: auditEventResultSchema,
  requestId: z.string(),
  timestamp: z.string().datetime(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

/**
 * Creates and durably forwards a structured audit event for security-sensitive actions.
 * Audit records MUST exclude message content and secrets.
 * Time Complexity: O(1)
 * Space Complexity: O(1) additional memory per event
 */
export function recordAuditEvent(
  params: Omit<AuditEvent, "timestamp"> & { timestamp?: string | Date },
): void {
  // Ensure we don't accidentally leak secrets or message content by strictly mapping properties
  const event: AuditEvent = {
    actor: params.actor,
    action: params.action,
    targetType: params.targetType,
    safeTargetReference: params.safeTargetReference,
    result: params.result,
    requestId: params.requestId,
    timestamp: params.timestamp
      ? params.timestamp instanceof Date
        ? params.timestamp.toISOString()
        : params.timestamp
      : new Date().toISOString(),
  };

  // Validate to ensure no malformed audit logs
  auditEventSchema.parse(event);

  // In this serverless/Cloudflare worker environment, we durably forward audit events
  // to our logging pipeline via structured stdout logs.
  console.info(JSON.stringify({ _audit: true, ...event }));
}
