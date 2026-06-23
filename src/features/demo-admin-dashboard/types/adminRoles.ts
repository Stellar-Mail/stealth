/**
 * Admin roles and permissions for campaign data editing.
 *
 * All data is fake, deterministic, and safe for public repository review.
 * No real user records, auth tokens, or live access control is implemented.
 * These types document the intended future role model so contributors can
 * reason about which dashboard operations map to which permission level.
 */

/**
 * The set of admin roles in the demo dashboard.
 * Role names are ordered from least to most privileged.
 */
export type AdminRole =
  | "viewer"
  | "editor"
  | "reviewer"
  | "campaign-manager"
  | "super-admin";

/**
 * Granular permissions that a role may grant.
 * Each permission maps to one or more dashboard operations.
 */
export type AdminPermission =
  | "campaign:view"
  | "campaign:create"
  | "campaign:edit"
  | "campaign:delete"
  | "campaign:publish"
  | "campaign:rollback"
  | "campaign:assign"
  | "campaign:tag"
  | "campaign:export"
  | "campaign:import"
  | "draft:view"
  | "draft:create"
  | "draft:edit"
  | "draft:delete"
  | "audit:view"
  | "audit:export"
  | "role:view"
  | "role:manage"
  | "dataset:view"
  | "dataset:edit"
  | "dataset:export"
  | "dataset:import"
  | "preset:switch"
  | "settings:view"
  | "settings:edit";

/**
 * Maps every permission to the operations it governs.
 * This is a documentation aid, not a runtime enforcement mechanism.
 */
export const PERMISSION_DESCRIPTIONS: Record<AdminPermission, string> = {
  "campaign:view": "View campaign metadata, tags, and draft list",
  "campaign:create": "Create a new campaign from scratch",
  "campaign:edit": "Modify campaign name, description, audience, status",
  "campaign:delete": "Remove a campaign and its associated drafts",
  "campaign:publish": "Execute the mock publish flow for a campaign",
  "campaign:rollback": "Restore a previous campaign snapshot",
  "campaign:assign": "Assign or reassign drafts to a campaign",
  "campaign:tag": "Add, remove, or reorder campaign tags",
  "campaign:export": "Export campaign data as JSON",
  "campaign:import": "Import a campaign from a JSON snapshot",
  "draft:view": "View individual draft content",
  "draft:create": "Create a new draft within a campaign",
  "draft:edit": "Modify draft subject, body, recipients",
  "draft:delete": "Remove a draft from a campaign",
  "audit:view": "View the campaign audit log",
  "audit:export": "Export audit log entries",
  "role:view": "View the role and permission matrix",
  "role:manage": "Assign roles to demo users",
  "dataset:view": "View the full demo dataset",
  "dataset:edit": "Modify demo dataset records",
  "dataset:export": "Export the demo dataset as JSON",
  "dataset:import": "Import fixture data into the demo dataset",
  "preset:switch": "Change the active protocol scenario preset",
  "settings:view": "View dashboard settings",
  "settings:edit": "Modify dashboard configuration",
};

/**
 * Role-to-permission assignment.
 *
 * Each role inherits all permissions of the role below it, plus its own.
 * The hierarchy is: viewer → editor → reviewer → campaign-manager → super-admin
 */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  viewer: [
    "campaign:view",
    "draft:view",
    "audit:view",
    "dataset:view",
    "preset:switch",
    "settings:view",
    "role:view",
  ],

  editor: [
    "campaign:view",
    "campaign:tag",
    "campaign:export",
    "draft:view",
    "draft:create",
    "draft:edit",
    "audit:view",
    "dataset:view",
    "dataset:edit",
    "dataset:export",
    "preset:switch",
    "settings:view",
    "role:view",
  ],

  reviewer: [
    "campaign:view",
    "campaign:tag",
    "campaign:export",
    "campaign:rollback",
    "draft:view",
    "draft:create",
    "draft:edit",
    "draft:delete",
    "audit:view",
    "audit:export",
    "dataset:view",
    "dataset:edit",
    "dataset:export",
    "preset:switch",
    "settings:view",
    "role:view",
  ],

  "campaign-manager": [
    "campaign:view",
    "campaign:create",
    "campaign:edit",
    "campaign:delete",
    "campaign:publish",
    "campaign:rollback",
    "campaign:assign",
    "campaign:tag",
    "campaign:export",
    "campaign:import",
    "draft:view",
    "draft:create",
    "draft:edit",
    "draft:delete",
    "audit:view",
    "audit:export",
    "dataset:view",
    "dataset:edit",
    "dataset:export",
    "dataset:import",
    "preset:switch",
    "settings:view",
    "settings:edit",
    "role:view",
  ],

  "super-admin": [
    "campaign:view",
    "campaign:create",
    "campaign:edit",
    "campaign:delete",
    "campaign:publish",
    "campaign:rollback",
    "campaign:assign",
    "campaign:tag",
    "campaign:export",
    "campaign:import",
    "draft:view",
    "draft:create",
    "draft:edit",
    "draft:delete",
    "audit:view",
    "audit:export",
    "role:view",
    "role:manage",
    "dataset:view",
    "dataset:edit",
    "dataset:export",
    "dataset:import",
    "preset:switch",
    "settings:view",
    "settings:edit",
  ],
};

/**
 * Every permission listed by role for quick reference.
 * The viewer role is the baseline; each subsequent role adds capabilities.
 */
export type RolePermissionMap = typeof ROLE_PERMISSIONS;

/**
 * Helper: return all permissions a role grants.
 */
export function getPermissionsForRole(role: AdminRole): readonly AdminPermission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Helper: check whether a role has a specific permission.
 */
export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly AdminPermission[]).includes(permission);
}
