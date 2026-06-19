export type ReviewItemStatus = "pending" | "approved" | "rejected" | "escalated";

export interface ReviewItem {
  id: string;
  submitterId: string;
  contentSnippet: string;
  submittedAt: string;
  status: ReviewItemStatus;
  riskScore: number;
}

export interface QueueFilters {
  status?: ReviewItemStatus;
  minRiskScore?: number;
}

// Engine API Inputs
export interface FetchQueueInput {
  filters?: QueueFilters;
  limit?: number;
  offset?: number;
}

export interface UpdateReviewStatusInput {
  itemId: string;
  newStatus: ReviewItemStatus;
  reviewerNotes?: string;
}

// Engine API Outputs
export interface FetchQueueOutput {
  items: ReviewItem[];
  totalCount: number;
}

export interface ReviewEngineState {
  isLoading: boolean;
  error: string | null;
  items: ReviewItem[];
}
