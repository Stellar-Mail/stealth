export type FlagStatus = "OPEN" | "RESOLVED";
export type FlagSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ReviewFlag {
  flagId: string;
  targetId: string;
  raisedBy: string;
  reason: string;
  severity: FlagSeverity;
  status: FlagStatus;
  raisedAt: string;
  resolvedBy?: string;
  resolution?: string;
  resolvedAt?: string;
}

export interface RaiseInput {
  targetId: string;
  raisedBy: string;
  reason: string;
  severity: FlagSeverity;
}

export interface ResolveInput {
  flagId: string;
  resolvedBy: string;
  resolution: string;
}

export const mockOpenFlag: ReviewFlag = {
  flagId: "flag_001",
  targetId: "doc_abc",
  raisedBy: "usr_compliance12",
  reason: "Unverified data source cited in reply.",
  severity: "HIGH",
  status: "OPEN",
  raisedAt: "2023-10-01T10:00:00Z",
};

export const mockResolvedFlag: ReviewFlag = {
  flagId: "flag_002",
  targetId: "doc_def",
  raisedBy: "usr_compliance12",
  reason: "Conflicting compliance claim.",
  severity: "MEDIUM",
  status: "RESOLVED",
  raisedAt: "2023-09-20T09:00:00Z",
  resolvedBy: "usr_compliance99",
  resolution: "Verified against policy 4.2; cleared.",
  resolvedAt: "2023-09-21T15:30:00Z",
};

export const mockRaiseInput: RaiseInput = {
  targetId: "doc_xyz",
  raisedBy: "usr_compliance12",
  reason: "Potential PII leakage in draft.",
  severity: "CRITICAL",
};

export const mockResolveInput: ResolveInput = {
  flagId: "flag_001",
  resolvedBy: "usr_compliance99",
  resolution: "Redacted PII; cleared.",
};

export const mockFlagList: ReviewFlag[] = [mockOpenFlag, mockResolvedFlag];
