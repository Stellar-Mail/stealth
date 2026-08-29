import { createFileRoute } from "@tanstack/react-router";

import { FeedbackOperations } from "@/features/admin/FeedbackOperations";

export const Route = createFileRoute("/admin/feedback")({
  component: FeedbackOperations,
});
