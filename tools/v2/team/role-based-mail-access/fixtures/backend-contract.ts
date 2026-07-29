import type {
  VerifyAccessRequest,
  UpdatePolicyInput,
  BatchVerifyAccessInput,
  CheckLimitsInput,
} from "../types";

// ---------------------------------------------------------------------------
// Success Fixtures
// ---------------------------------------------------------------------------

export const validVerifyAccessInputFixture: VerifyAccessRequest = {
  requesterEmail: "alice@example.test",
  role: "manager",
  accessLevel: "assign",
  threadId: "thread-support-001",
};

export const validVerifyAccessDeniedFixture: VerifyAccessRequest = {
  requesterEmail: "carol@example.test",
  role: "viewer",
  accessLevel: "write",
  threadId: "thread-legal-007",
};

export const validUpdatePolicyInputFixture: UpdatePolicyInput = {
  role: "agent",
  accessLevels: ["read", "write", "assign"],
};

export const validBatchVerifyInputFixture: BatchVerifyAccessInput = {
  requests: [
    {
      requesterEmail: "alice@example.test",
      role: "manager",
      accessLevel: "assign",
      threadId: "thread-support-001",
    },
    {
      requesterEmail: "bob@example.test",
      role: "agent",
      accessLevel: "read",
      threadId: "thread-billing-042",
    },
    {
      requesterEmail: "carol@example.test",
      role: "viewer",
      accessLevel: "write",
      threadId: "thread-legal-007",
    },
  ],
};

export const validCheckLimitsInputFixture: CheckLimitsInput = {
  teamSize: 50,
  attachmentCount: 10,
};

// ---------------------------------------------------------------------------
// Failure Fixtures
// ---------------------------------------------------------------------------

export const invalidInputEmptyEmailFixture: VerifyAccessRequest = {
  requesterEmail: "",
  role: "admin",
  accessLevel: "read",
  threadId: "thread-001",
};

export const invalidInputThreadIdPathTraversalFixture: VerifyAccessRequest = {
  requesterEmail: "alice@example.test",
  role: "admin",
  accessLevel: "read",
  threadId: "../../etc/passwd",
};

export const unknownRoleInputFixture: VerifyAccessRequest = {
  requesterEmail: "alice@example.test",
  role: "hacker",
  accessLevel: "read",
  threadId: "thread-001",
};

export const unknownAccessLevelInputFixture: VerifyAccessRequest = {
  requesterEmail: "alice@example.test",
  role: "admin",
  accessLevel: "destroy",
  threadId: "thread-001",
};

export const limitExceededTeamSizeFixture: CheckLimitsInput = {
  teamSize: 600,
  attachmentCount: 10,
};

export const limitExceededAttachmentCountFixture: CheckLimitsInput = {
  teamSize: 50,
  attachmentCount: 150,
};

export const invalidUpdatePolicyRoleFixture: UpdatePolicyInput = {
  role: "superuser",
  accessLevels: ["read"],
};

export const invalidUpdatePolicyLevelFixture: UpdatePolicyInput = {
  role: "admin",
  accessLevels: ["nuke"],
};
