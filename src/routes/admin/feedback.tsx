import { createFileRoute } from "@tanstack/react-router";
import { FeedbackPanel } from "@/features/feedback/FeedbackAdminPanel";

export const Route = createFileRoute("/admin/feedback")({
  component: FeedbackAdminPage,
});

function FeedbackAdminPage() {
  return <FeedbackPanel />;
}
