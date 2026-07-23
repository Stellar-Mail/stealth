export type Permission =
  "READ_SENSITIVE" | "REPLY_AS_TEAM" | "DELETE_THREAD" | "VIEW_INTERNAL_NOTES";

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface UserContext {
  userId: string;
  roles: Role[];
}

export interface MailAccessRequest {
  mailId: string;
  requiredPermissions: Permission[];
}

export interface AccessEvaluation {
  isGranted: boolean;
  missingPermissions: Permission[];
}

export interface WorkflowResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
