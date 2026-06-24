// Communication tracking and history types

export interface CommunicationRecord {
  id: string;
  vendorId: string;
  timestamp: Date;
  type: CommunicationType;
  subject?: string;
  preview?: string;
  status: CommunicationStatus;
  metadata?: Record<string, unknown>;
}

export enum CommunicationType {
  EMAIL = "email",
  NOTIFICATION = "notification",
  ALERT = "alert",
  BILLING = "billing",
  SUPPORT = "support",
  OTHER = "other",
}

export enum CommunicationStatus {
  RECEIVED = "received",
  READ = "read",
  ARCHIVED = "archived",
  FLAGGED = "flagged",
  SPAM = "spam",
}

export interface TrackingFilter {
  vendorId?: string;
  type?: CommunicationType[];
  status?: CommunicationStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface VendorTrackingStats {
  vendorId: string;
  totalMessages: number;
  messagesByType: Record<CommunicationType, number>;
  messagesByStatus: Record<CommunicationStatus, number>;
  lastContactDate?: Date;
  averageResponseTime?: number; // in milliseconds
}
