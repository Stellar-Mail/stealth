import React, { useState } from "react";

type EscalationState = "idle" | "loading" | "success" | "error" | "empty";

export const EscalationTool: React.FC = () => {
  const [state, setState] = useState<EscalationState>("idle");

  return (
    <div
      className="p-6 border rounded-xl max-w-3xl mx-auto bg-white shadow-sm"
      role="region"
      aria-labelledby="escalation-tool-heading"
    >
      <header className="mb-6 border-b pb-4">
        <h2 className="text-2xl font-semibold text-gray-800" id="escalation-tool-heading">
          Escalation Tool
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Review, route, and resolve high-priority support tickets and escalated emails.
        </p>
      </header>

      {/* State Controls for UI demonstration */}
      <div
        className="flex flex-wrap gap-2 mb-6"
        role="group"
        aria-label="Escalation state controls"
      >
        <button
          onClick={() => setState("loading")}
          className="px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "loading"}
        >
          Load Active Escalations
        </button>
        <button
          onClick={() => setState("empty")}
          className="px-4 py-2 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "empty"}
        >
          View Empty Inbox
        </button>
        <button
          onClick={() => setState("error")}
          className="px-4 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "error"}
        >
          Simulate Error
        </button>
        <button
          onClick={() => setState("success")}
          className="px-4 py-2 bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "success"}
        >
          Simulate Success
        </button>
      </div>

      {/* Live Region for Screen Readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="min-h-[300px] bg-gray-50 rounded-lg border border-gray-100 p-4"
      >
        {state === "idle" && (
          <div className="flex items-center justify-center h-full min-h-[250px]">
            <p className="text-gray-500 text-center">
              Select an action above to load the escalation queue.
            </p>
          </div>
        )}

        {state === "loading" && (
          <div
            className="flex flex-col items-center justify-center h-full min-h-[250px]"
            aria-busy="true"
            aria-label="Loading active escalations"
          >
            <div
              className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"
              role="presentation"
            ></div>
            <span className="text-purple-600 font-medium">Fetching active escalations...</span>
          </div>
        )}

        {state === "empty" && (
          <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-center px-4">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-3">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">Inbox Zero</h3>
            <p className="text-gray-500 mt-1 max-w-sm">
              There are no escalated items requiring your attention at this time.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center justify-center h-full min-h-[250px] px-4">
            <div
              className="bg-red-50 border border-red-200 p-5 rounded-lg max-w-md w-full"
              role="alert"
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="text-red-500 text-lg" aria-hidden="true">
                    ⚠️
                  </span>
                </div>
                <div className="ml-3 w-full">
                  <h3 className="text-red-800 font-medium text-base">Failed to sync escalations</h3>
                  <p className="text-red-600 mt-1 text-sm">
                    Unable to connect to the internal routing service. Please verify your connection
                    and try again.
                  </p>
                  <div className="mt-4">
                    <button
                      onClick={() => setState("loading")}
                      className="px-3 py-1.5 bg-red-100 text-red-800 rounded-md text-sm font-medium hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors"
                    >
                      Retry Connection
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {state === "success" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2 px-2">
              <span
                className="text-sm font-medium text-gray-500 uppercase tracking-wider"
                aria-live="polite"
              >
                2 Active Escalations
              </span>
            </div>

            <ul className="space-y-3" aria-label="Active Escalation List">
              <li
                className="p-5 border border-red-200 rounded-lg bg-red-50 shadow-sm hover:border-red-300 focus-within:ring-2 focus-within:ring-red-500 focus-within:border-red-500 outline-none transition-all"
                tabIndex={0}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-bold rounded uppercase tracking-wide">
                        High Priority
                      </span>
                      <span className="text-sm text-gray-500">Ticket #84920</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 text-lg">
                      VIP Customer Payment Failure
                    </h4>
                  </div>
                  <span className="text-sm text-gray-500">2 hrs ago</span>
                </div>
                <p className="text-sm text-gray-700 mb-4 bg-white p-3 rounded border border-red-100 shadow-sm">
                  Enterprise customer reported multiple failed transactions on their primary routing
                  account. Escalate to Engineering immediately.
                </p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors">
                    Acknowledge & Route
                  </button>
                  <button className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                    Dismiss
                  </button>
                </div>
              </li>

              <li
                className="p-5 border border-orange-200 rounded-lg bg-orange-50 shadow-sm hover:border-orange-300 focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500 outline-none transition-all"
                tabIndex={0}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-orange-200 text-orange-800 text-xs font-bold rounded uppercase tracking-wide">
                        Medium Priority
                      </span>
                      <span className="text-sm text-gray-500">Ticket #84915</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 text-lg">
                      Billing Discrepancy Inquiry
                    </h4>
                  </div>
                  <span className="text-sm text-gray-500">1 day ago</span>
                </div>
                <p className="text-sm text-gray-700 mb-4 bg-white p-3 rounded border border-orange-100 shadow-sm">
                  User is requesting a manual review of their last invoice due to an unapplied
                  credit.
                </p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors">
                    Acknowledge & Route
                  </button>
                  <button className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                    Dismiss
                  </button>
                </div>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
