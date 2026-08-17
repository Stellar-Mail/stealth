// Analytics and metrics types

export interface VendorMetrics {
  vendorId: string;
  totalInteractions: number;
  engagementScore: number; // 0-100
  communicationFrequency: number; // messages per week
  lastInteraction: Date;
  trend: Trend;
  metadata?: Record<string, unknown>;
}

export enum Trend {
  INCREASING = "increasing",
  STABLE = "stable",
  DECREASING = "decreasing",
}

export interface AnalyticsFilter {
  timeRange?: {
    start: Date;
    end: Date;
  };
  minEngagement?: number;
  vendorIds?: string[];
}

export interface AnalyticsSummary {
  totalVendors: number;
  totalInteractions: number;
  averageEngagementScore: number;
  topVendors: VendorMetrics[];
  communicationTrends: Record<string, number>;
}
