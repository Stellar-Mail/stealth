import React, { useState } from "react";

type TrackerState = "idle" | "loading" | "success" | "error" | "empty";

export const DealLeadMailTracker: React.FC = () => {
  const [state, setState] = useState<TrackerState>("idle");

  return (
    <div
      className="p-6 border rounded-lg max-w-2xl mx-auto"
      role="region"
      aria-labelledby="tracker-heading"
    >
      <header className="mb-4">
        <h2 className="text-xl font-bold" id="tracker-heading">
          Deal/Lead Mail Tracker
        </h2>
        <p className="text-sm text-gray-600">
          Track and manage team deals and leads isolated from the main inbox.
        </p>
      </header>

      {/* Controls for demo purposes to show different states */}
      <div className="flex gap-2 mb-6" role="group" aria-label="Tracker state controls">
        <button
          onClick={() => setState("loading")}
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-pressed={state === "loading"}
        >
          Simulate Loading
        </button>
        <button
          onClick={() => setState("empty")}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          aria-pressed={state === "empty"}
        >
          Simulate Empty
        </button>
        <button
          onClick={() => setState("error")}
          className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          aria-pressed={state === "error"}
        >
          Simulate Error
        </button>
        <button
          onClick={() => setState("success")}
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          aria-pressed={state === "success"}
        >
          Simulate Success
        </button>
      </div>

      {/* Live Region for Screen Readers */}
      <div aria-live="polite" aria-atomic="true" className="min-h-[200px] border-t pt-4">
        {state === "idle" && (
          <p className="text-gray-500">Select an action above to load tracker data.</p>
        )}

        {state === "loading" && (
          <div
            className="flex flex-col items-center justify-center h-32"
            aria-busy="true"
            aria-label="Loading tracker data"
          >
            <div
              className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2"
              role="presentation"
            ></div>
            <span className="text-blue-600 font-medium">Loading...</span>
          </div>
        )}

        {state === "empty" && (
          <div className="text-center py-8">
            <h3 className="text-lg font-medium text-gray-900">No deals or leads found</h3>
            <p className="text-gray-500 mt-1">There are no tracked items in the current view.</p>
          </div>
        )}

        {state === "error" && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-md" role="alert">
            <h3 className="text-red-800 font-medium">Failed to load tracker data</h3>
            <p className="text-red-600 mt-1">
              There was a problem communicating with the local service. Please try again.
            </p>
            <button
              onClick={() => setState("idle")}
              className="mt-3 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {state === "success" && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-4 rounded-md mb-4" role="status">
              <span className="text-green-800 font-medium">Successfully loaded 2 items.</span>
            </div>

            <ul className="space-y-2" aria-label="Tracked Deals and Leads">
              <li
                className="p-4 border rounded-lg bg-white shadow-sm hover:bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500 outline-none"
                tabIndex={0}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Acme Corp</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    Deal
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Negotiation phase. Last contacted 2 days ago.
                </p>
              </li>
              <li
                className="p-4 border rounded-lg bg-white shadow-sm hover:bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500 outline-none"
                tabIndex={0}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Globex</span>
                  <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-full">
                    Lead
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">Initial outreach required.</p>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
