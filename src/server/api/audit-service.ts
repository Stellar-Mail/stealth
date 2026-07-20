import crypto from "node:crypto";

export interface AuditEventContext {
  request: Request;
  actor: string;
}

export interface PolicyAuditEvent {
  requestId: string;
  timestamp: string;
  actor: string;
  owner: string;
  action: "update_mailbox_policy" | "update_sender_rule" | "delete_sender_rule";
  target: {
    type: "mailbox_policy" | "sender_rule";
    sender?: string;
  };
  changes: {
    before: Record<string, unknown> | string | null;
    after: Record<string, unknown> | string | null;
  };
  status: "success" | "failure";
  error?: string;
}

export function logPolicyAuditEvent(params: {
  ctx: AuditEventContext;
  owner: string;
  action: PolicyAuditEvent["action"];
  targetType: PolicyAuditEvent["target"]["type"];
  sender?: string;
  before: PolicyAuditEvent["changes"]["before"];
  after: PolicyAuditEvent["changes"]["after"];
  status: PolicyAuditEvent["status"];
  error?: string;
}) {
  const requestId = params.ctx.request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  
  const event: PolicyAuditEvent = {
    requestId,
    timestamp: new Date().toISOString(),
    actor: params.ctx.actor,
    owner: params.owner,
    action: params.action,
    target: {
      type: params.targetType,
      ...(params.sender ? { sender: params.sender } : {}),
    },
    changes: {
      before: params.before,
      after: params.after,
    },
    status: params.status,
    ...(params.error ? { error: params.error } : {}),
  };

  // Structured logging to console
  console.log(JSON.stringify(event));
}
