import React, { useState } from "react";

type SuggestionState = "idle" | "loading" | "success" | "error" | "empty";

export const KnowledgeBaseSuggestion: React.FC = () => {
  const [state, setState] = useState<SuggestionState>("idle");

  return (
    <div
      className="p-6 border rounded-xl max-w-3xl mx-auto bg-white shadow-sm"
      role="region"
      aria-labelledby="kb-suggestion-heading"
    >
      <header className="mb-6 border-b pb-4">
        <h2 className="text-2xl font-semibold text-gray-800" id="kb-suggestion-heading">
          Knowledge Base Suggestions
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Review AI-suggested documentation links based on active email threads and support tickets.
        </p>
      </header>

      {/* State Controls for UI demonstration */}
      <div
        className="flex flex-wrap gap-2 mb-6"
        role="group"
        aria-label="Suggestion state controls"
      >
        <button
          onClick={() => setState("loading")}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "loading"}
        >
          Analyze Thread
        </button>
        <button
          onClick={() => setState("empty")}
          className="px-4 py-2 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "empty"}
        >
          No Matches Found
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
          className="px-4 py-2 bg-teal-50 text-teal-700 rounded-md hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "success"}
        >
          View Suggestions
        </button>
      </div>

      {/* Live Region for Screen Readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="min-h-[250px] bg-gray-50 rounded-lg border border-gray-100 p-4"
      >
        {state === "idle" && (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <p className="text-gray-500 text-center">
              Click "Analyze Thread" to fetch relevant knowledge base articles.
            </p>
          </div>
        )}

        {state === "loading" && (
          <div
            className="flex flex-col items-center justify-center h-full min-h-[200px]"
            aria-busy="true"
            aria-label="Analyzing email content for suggestions"
          >
            <div
              className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"
              role="presentation"
            ></div>
            <span className="text-indigo-600 font-medium">Scanning knowledge base...</span>
          </div>
        )}

        {state === "empty" && (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-3">
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">No suggestions found</h3>
            <p className="text-gray-500 mt-1 max-w-sm">
              We couldn't find any relevant documentation matching the context of this conversation.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] px-4">
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
                  <h3 className="text-red-800 font-medium text-base">Search service unavailable</h3>
                  <p className="text-red-600 mt-1 text-sm">
                    Unable to connect to the knowledge base indexer. Please verify your connection
                    and try again.
                  </p>
                  <div className="mt-4">
                    <button
                      onClick={() => setState("loading")}
                      className="px-3 py-1.5 bg-red-100 text-red-800 rounded-md text-sm font-medium hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors"
                    >
                      Retry Analysis
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
                2 Recommended Articles
              </span>
            </div>

            <ul className="space-y-3" aria-label="Suggested Articles List">
              <li
                className="p-4 border border-indigo-200 rounded-lg bg-indigo-50 shadow-sm hover:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 outline-none transition-all"
                tabIndex={0}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-base mb-1">
                      Configuring Wallet Authentication
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      Learn how to securely configure web3 wallet signatures, challenge issuance,
                      and JSON Web Token (JWT) validation flows for new users.
                    </p>
                  </div>
                  <span className="inline-flex items-center justify-center px-2 py-1 ml-4 text-xs font-bold leading-none text-indigo-100 bg-indigo-600 rounded">
                    98% Match
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
                    Insert Link
                  </button>
                  <button className="flex-1 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                    Preview
                  </button>
                </div>
              </li>

              <li
                className="p-4 border border-teal-200 rounded-lg bg-teal-50 shadow-sm hover:border-teal-300 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 outline-none transition-all"
                tabIndex={0}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-base mb-1">
                      Troubleshooting Stellar Node Sync Issues
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      Common resolution paths for when the EventIndexer falls behind the active
                      ledger or drops webhook payloads during network congestion.
                    </p>
                  </div>
                  <span className="inline-flex items-center justify-center px-2 py-1 ml-4 text-xs font-bold leading-none text-teal-800 bg-teal-200 rounded">
                    85% Match
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 py-1.5 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors">
                    Insert Link
                  </button>
                  <button className="flex-1 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                    Preview
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
