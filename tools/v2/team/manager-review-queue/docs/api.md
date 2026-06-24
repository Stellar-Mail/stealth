# Manager Review Queue - Core Feature API

This document details the folder-local API surface exposed by the `services/reviewEngine.ts` module. All logic runs locally against deterministic fixtures. There are no live network calls or production data introduced.

## State Management Guidelines

For future UI integration, the component state should reflect:

```ts
interface ReviewEngineState {
  isLoading: boolean; // Set to true while fetch/update promises are resolving
  error: string | null; // Set if an update fails (e.g. item not found)
  items: ReviewItem[]; // The currently loaded queue
}
```

## API Methods

### 1. `fetchReviewQueue`

Fetches a list of queue items from the local mock store.

**Input:**

```ts
interface FetchQueueInput {
  filters?: {
    status?: "pending" | "approved" | "rejected" | "escalated";
    minRiskScore?: number;
  };
  limit?: number;
  offset?: number;
}
```

**Output:**

```ts
interface FetchQueueOutput {
  items: ReviewItem[];
  totalCount: number;
}
```

**Loading State:** The function simulates a network delay (500ms). UI should set `isLoading = true` while awaiting this promise.
**Error State:** Currently does not throw errors.

---

### 2. `updateReviewItemStatus`

Updates the status of an existing review item.

**Input:**

```ts
interface UpdateReviewStatusInput {
  itemId: string;
  newStatus: "pending" | "approved" | "rejected" | "escalated";
  reviewerNotes?: string;
}
```

**Output:**

```ts
// Returns the updated ReviewItem object
interface ReviewItem {
  id: string;
  submitterId: string;
  contentSnippet: string;
  submittedAt: string;
  status: ReviewItemStatus;
  riskScore: number;
}
```

**Loading State:** Simulates a network delay (500ms). UI should disable submit buttons while awaiting.
**Error State:** Throws an `Error` if the provided `itemId` does not exist in the store. The UI should catch this error and display its message to the user.
