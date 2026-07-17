import {
  UserContext,
  MailAccessRequest,
  AccessEvaluation,
  Permission,
  WorkflowResult,
} from "./types";

/**
 * Extracts all unique permissions granted to a user across their assigned roles.
 */
export const getUserPermissions = (user: UserContext): Set<Permission> => {
  const permissions = new Set<Permission>();
  user.roles.forEach((role) => {
    role.permissions.forEach((permission) => permissions.add(permission));
  });
  return permissions;
};

/**
 * Evaluates whether a user has the required permissions to access a specific mail thread.
 * This is a pure function that returns a detailed AccessEvaluation result.
 */
export const evaluateMailAccess = (
  user: UserContext,
  request: MailAccessRequest,
): AccessEvaluation => {
  const userPermissions = getUserPermissions(user);
  const missingPermissions = request.requiredPermissions.filter(
    (reqPerm) => !userPermissions.has(reqPerm),
  );

  return {
    isGranted: missingPermissions.length === 0,
    missingPermissions,
  };
};

/**
 * Helper to validate a user's action against their permissions.
 * Returns a WorkflowResult to handle UI error states easily.
 */
export const validateAction = (
  user: UserContext,
  actionPermission: Permission,
): WorkflowResult<boolean> => {
  const userPermissions = getUserPermissions(user);

  if (userPermissions.has(actionPermission)) {
    return { success: true, data: true };
  }

  return {
    success: false,
    error: `Access Denied: You lack the '${actionPermission}' permission required to perform this action.`,
  };
};
