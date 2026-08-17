import React, { useState, useEffect } from "react";
import { SharedDraftEmptyState } from "./SharedDraftEmptyState";
import { SharedDraftLoadingState } from "./SharedDraftLoadingState";
import { SharedDraftErrorState } from "./SharedDraftErrorState";
import { SharedDraftList } from "./SharedDraftList";

interface SharedDraftData {
  id: string;
  title: string;
  lastModified: string;
  collaborators: number;
  subject?: string;
  isActive?: boolean;
}

type DraftState = "loading" | "error" | "empty" | "success";

/**
 * SharedDraftCollaboration
 * Main application component for shared draft collaboration tool
 *
 * Features:
 * - Loading, error, empty, and success states
 * - Keyboard accessible throughout
 * - Screen reader friendly
 * - Local test fixtures for development
 * - Self-contained UI isolation from main app
 *
 * Accessibility:
 * - Semantic HTML structure
 * - ARIA labels and roles
 * - Keyboard navigation (Tab, Enter, Escape)
 * - Focus management
 * - Color contrast compliance
 * - Screen reader announcements
 */
export const SharedDraftCollaboration: React.FC = () => {
  const [state, setState] = useState<DraftState>("loading");
  const [drafts, setDrafts] = useState<SharedDraftData[]>([]);
  const [error, setError] = useState<string>("");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Simulate data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      // Load from local fixture
      const fixtureDrafts: SharedDraftData[] = [
        {
          id: "1",
          title: "Q1 Team Updates",
          subject: "Monthly updates for leadership",
          lastModified: "2025-01-15T14:30:00Z",
          collaborators: 3,
          isActive: true,
        },
        {
          id: "2",
          title: "Project Proposal - Feature X",
          subject: "New product feature proposal",
          lastModified: "2025-01-14T10:15:00Z",
          collaborators: 2,
          isActive: false,
        },
        {
          id: "3",
          title: "Customer Response Template",
          subject: "Template for common customer inquiries",
          lastModified: "2025-01-12T16:45:00Z",
          collaborators: 4,
          isActive: false,
        },
      ];

      setDrafts(fixtureDrafts);
      setState(fixtureDrafts.length === 0 ? "empty" : "success");
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleEditDraft = (id: string) => {
    console.log("Edit draft - would open editor in integrated app", id);
    setActiveDraftId(id);
  };

  const handleCreateNew = () => {
    console.log("Create new draft - would open creation modal in integrated app");
  };

  const handleRetry = () => {
    setState("loading");
    setError("");
    // Retry logic would go here
    setTimeout(() => {
      setState(drafts.length === 0 ? "empty" : "success");
    }, 500);
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-white rounded-lg">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Shared Draft Collaboration</h1>
        <p className="text-slate-600 text-sm mt-1">
          Collaborate with team members on email drafts in real-time
        </p>
      </header>

      <main role="main" className="space-y-4">
        {state === "loading" && <SharedDraftLoadingState />}
        {state === "error" && <SharedDraftErrorState error={error} onRetry={handleRetry} />}
        {state === "empty" && <SharedDraftEmptyState />}
        {state === "success" && (
          <SharedDraftList drafts={drafts} onEdit={handleEditDraft} onCreateNew={handleCreateNew} />
        )}
      </main>

      {activeDraftId && (
        <div className="mt-8 p-4 bg-slate-100 rounded-lg text-sm text-slate-600">
          <p>
            Draft "{drafts.find((d) => d.id === activeDraftId)?.title}" selected - editor would
            display here in integrated app
          </p>
        </div>
      )}
    </div>
  );
};
