/**
 * Types for the Campaign Audit Log feature.
 */
export type CampaignAction = "create" | "update" | "assign" | "publish" | "rollback";
export type CampaignTarget = "Campaign" | "Draft" | "Template";

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601 format
  actor: {
    id: string;
    name: string; // e.g., 'Admin User'
  };
  action: CampaignAction;
  target: {
    type: CampaignTarget;
    id: string;
    name: string; // e.g., 'Welcome Campaign'
  };
  details?: Record<string, any>; // For 'update' actions, e.g., { from: 'draft', to: 'ready' }
}

/**
 * Creates a new audit log entry.
 * Ensures deterministic ID and structure.
 */
export const createAuditEntry = (data: Omit<AuditLogEntry, "id">): AuditLogEntry => {
  // Create a deterministic ID from the entry's own data.
  const uniquePart = (data.target.id + data.action).slice(-8);
  return {
    id: `audit-${new Date(data.timestamp).getTime()}-${uniquePart}`,
    ...data,
  };
};

/**
 * Formats an audit log entry into a human-readable string.
 */
export const formatAuditEntry = (entry: AuditLogEntry): string => {
  const { actor, action, target, details } = entry;

  switch (action) {
    case "create":
      return `${actor.name} created the ${target.type.toLowerCase()} "${target.name}".`;
    case "update":
      if (details && details.field) {
        return `${actor.name} updated the ${details.field} of ${target.type.toLowerCase()} "${
          target.name
        }" from "${details.from}" to "${details.to}".`;
      }
      return `${actor.name} updated the ${target.type.toLowerCase()} "${target.name}".`;
    case "assign":
      return `${actor.name} assigned the ${target.type.toLowerCase()} "${target.name}" to ${
        details?.assignee || "a team member"
      }.`;
    case "publish":
      return `${actor.name} published the ${target.type.toLowerCase()} "${target.name}".`;
    case "rollback":
      return `${actor.name} rolled back the ${target.type.toLowerCase()} "${
        target.name
      }" to version ${details?.version || "a previous state"}.`;
    default:
      return `An unknown action was performed by ${actor.name} on "${target.name}".`;
  }
};
