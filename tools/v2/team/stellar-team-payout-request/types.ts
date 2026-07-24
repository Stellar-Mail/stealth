export type PayoutRecipient = {
  address: string;
  amount: number;
};

export type PayoutRequest = {
  source: string;
  memo?: string;
  recipients: PayoutRecipient[];
  idempotencyKey: string;
};

export type SecurityIssue = { field: string; message: string };

export type SanitizeResult = {
  value: PayoutRequest;
  issues: SecurityIssue[];
};
