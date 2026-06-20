export interface DemoAccount {
  name: string;
  address: string;
  balance: string;
  type: string;
}

export interface DemoMail {
  subject: string;
  status: "delivered" | "pending" | "held";
  folder: string;
}

export interface DemoAuditEvent {
  action: string;
  actor: string;
  timestamp: string;
}

export interface DemoDashboardData {
  accounts: DemoAccount[];
  mail: DemoMail[];
  audit: DemoAuditEvent[];
}
