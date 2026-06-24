import { Role, UserContext, MailAccessRequest } from "../types";

export const mockAdminRole: Role = {
  id: "role_admin_1",
  name: "Administrator",
  description: "Full access to all mail threads and team settings.",
  permissions: ["READ_SENSITIVE", "REPLY_AS_TEAM", "DELETE_THREAD", "VIEW_INTERNAL_NOTES"],
};

export const mockSupportRole: Role = {
  id: "role_support_1",
  name: "Support Agent",
  description: "Can read and reply to standard support threads.",
  permissions: ["REPLY_AS_TEAM", "VIEW_INTERNAL_NOTES"],
};

export const mockReadOnlyRole: Role = {
  id: "role_readonly_1",
  name: "Auditor",
  description: "Can view threads but cannot modify or reply.",
  permissions: ["VIEW_INTERNAL_NOTES"],
};

export const mockAdminUser: UserContext = {
  userId: "usr_admin999",
  roles: [mockAdminRole],
};

export const mockSupportUser: UserContext = {
  userId: "usr_agent123",
  roles: [mockSupportRole],
};

export const mockRestrictedUser: UserContext = {
  userId: "usr_audit456",
  roles: [mockReadOnlyRole],
};

export const mockSensitiveMailRequest: MailAccessRequest = {
  mailId: "mail_sensitive_001",
  requiredPermissions: ["READ_SENSITIVE", "VIEW_INTERNAL_NOTES"],
};

export const mockStandardMailRequest: MailAccessRequest = {
  mailId: "mail_standard_002",
  requiredPermissions: [], // Open to anyone with base access
};
