import React, { useState, useEffect } from "react";
import { WatchlistEmptyState } from "./WatchlistEmptyState";
import { WatchlistLoadingState } from "./WatchlistLoadingState";
import { WatchlistErrorState } from "./WatchlistErrorState";
import { WatchlistList } from "./WatchlistList";

interface WatchlistEntryData {
  id: string;
  senderEmail: string;
  senderName: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  dateAdded: string;
}

type WatchlistState = "loading" | "error" | "empty" | "success";

/**
 * SuspiciousSenderWatchlist
 * Main application component for suspicious sender watchlist tool
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
export const SuspiciousSenderWatchlist: React.FC = () => {
  const [state, setState] = useState<WatchlistState>("loading");
  const [entries, setEntries] = useState<WatchlistEntryData[]>([]);
  const [error, setError] = useState<string>("");

  // Simulate data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      // Load from local fixture
      const fixtureEntries: WatchlistEntryData[] = [
        {
          id: "1",
          senderEmail: "noreply@phishing-example.com",
          senderName: "Phishing Alert",
          reason: "Known phishing domain",
          riskLevel: "high",
          dateAdded: "2025-01-10",
        },
        {
          id: "2",
          senderEmail: "suspicious@example.org",
          senderName: "Suspicious Sender",
          reason: "Multiple fraud reports",
          riskLevel: "medium",
          dateAdded: "2025-01-08",
        },
      ];

      setEntries(fixtureEntries);
      setState(fixtureEntries.length === 0 ? "empty" : "success");
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleRemoveEntry = (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    setState(updated.length === 0 ? "empty" : "success");
  };

  const handleAddNew = () => {
    console.log("Add new sender - would open modal in integrated app");
  };

  const handleRetry = () => {
    setState("loading");
    setError("");
    // Retry logic would go here
    setTimeout(() => {
      setState(entries.length === 0 ? "empty" : "success");
    }, 500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Suspicious Sender Watchlist</h1>
        <p className="text-slate-600 text-sm mt-1">
          Monitor and manage senders you want to keep track of
        </p>
      </header>

      <main role="main" className="space-y-4">
        {state === "loading" && <WatchlistLoadingState />}
        {state === "error" && <WatchlistErrorState error={error} onRetry={handleRetry} />}
        {state === "empty" && <WatchlistEmptyState />}
        {state === "success" && (
          <WatchlistList entries={entries} onRemove={handleRemoveEntry} onAddNew={handleAddNew} />
        )}
      </main>
    </div>
  );
};
