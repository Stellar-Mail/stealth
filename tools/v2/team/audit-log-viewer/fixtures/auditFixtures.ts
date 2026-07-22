import type { AuditLogEntry } from "../types";

export const mockAuditEntries: AuditLogEntry[] = [
  {
    id: "log_001",
    actorId: "usr_100",
    actorEmail: "admin@example.com",
    action: "user.role.changed",
    resourceType: "user",
    resourceId: "usr_204",
    timestamp: "2026-06-18T10:00:00Z",
    severity: "warning",
    ipAddress: "10.0.0.4",
  },
  {
    id: "log_002",
    actorId: "usr_100",
    actorEmail: "admin@example.com",
    action: "settings.updated",
    resourceType: "settings",
    resourceId: "org_1",
    timestamp: "2026-06-18T11:15:00Z",
    severity: "info",
    ipAddress: "10.0.0.4",
  },
  {
    id: "log_003",
    actorId: "usr_305",
    actorEmail: "ops@example.com",
    action: "wallet.key.rotated",
    resourceType: "wallet",
    resourceId: "wal_88",
    timestamp: "2026-06-17T09:45:00Z",
    severity: "critical",
    ipAddress: "10.0.0.9",
  },
  {
    id: "log_004",
    actorId: "usr_204",
    actorEmail: "member@example.com",
    action: "login.failed",
    resourceType: "session",
    resourceId: "sess_512",
    timestamp: "2026-06-16T08:00:00Z",
    severity: "warning",
    ipAddress: "203.0.113.7",
  },
];

export const MOCK_NETWORK_DELAY_MS = 500;
