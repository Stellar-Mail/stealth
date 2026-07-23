/** Where the contacts are coming from. */
export type ImportSource =
  "csv" | "provider-gmail" | "provider-outlook" | "contacts-api" | "manual";

/** How an imported address resolved against known identities. */
export type MatchType = "exact" | "fuzzy" | "ambiguous" | "none";

export type IdentityMatch = {
  type: MatchType;
  matchedAddress: string | null;
  matchedName: string | null;
  confidence: number;
  reason: string;
};

/** A row produced after parsing and identity matching. */
export type ImportedContactRow = {
  id: string;
  name: string;
  address: string;
  source: ImportSource;
  trust: "allow" | "block" | "default";
  match: IdentityMatch | null;
  error: string | null;
};

/** Single sender-rule write job. */
export type PolicyWriteJob = {
  id: string;
  owner: string;
  sender: string;
  action: "allow" | "block" | "remove";
  status: "pending" | "running" | "success" | "failed";
  error: string | null;
  retries: number;
};

export type BulkWriteStatus = "idle" | "running" | "paused" | "completed" | "failed";

export type BulkWriteProgress = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  currentBatch: number;
  totalBatches: number;
  status: BulkWriteStatus;
  jobs: PolicyWriteJob[];
  errors: { sender: string; error: string }[];
  resumeToken: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type DataRetentionPolicy = "session" | "1h" | "24h" | "7d" | "never";

export type ImportSession = {
  id: string;
  source: ImportSource;
  createdAt: string;
  rawDataRetention: DataRetentionPolicy;
  contactCount: number;
  assignedCount: number;
  policyWrites: number;
  bulkWrite: BulkWriteProgress | null;
};

/** Step in the migration wizard. */
export type MigrationStep = "source" | "parse" | "identity-review" | "trust" | "migrate" | "done";
