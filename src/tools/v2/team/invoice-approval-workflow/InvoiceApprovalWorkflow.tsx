import React, { useState } from "react";

type WorkflowState = "idle" | "loading" | "success" | "error" | "empty";

export const InvoiceApprovalWorkflow: React.FC = () => {
  const [state, setState] = useState<WorkflowState>("idle");

  return (
    <div
      className="p-6 border rounded-xl max-w-3xl mx-auto bg-white shadow-sm"
      role="region"
      aria-labelledby="invoice-workflow-heading"
    >
      <header className="mb-6 border-b pb-4">
        <h2 className="text-2xl font-semibold text-gray-800" id="invoice-workflow-heading">
          Invoice Approval Workflow
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Review, approve, or reject pending team invoices in isolation.
        </p>
      </header>

      {/* State Controls for UI demonstration */}
      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Workflow state controls">
        <button
          onClick={() => setState("loading")}
          className="px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "loading"}
        >
          Load Invoices
        </button>
        <button
          onClick={() => setState("empty")}
          className="px-4 py-2 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "empty"}
        >
          View Empty Queue
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
          className="px-4 py-2 bg-green-50 text-green-700 rounded-md hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "success"}
        >
          Simulate Success
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
              Select an action above to load the invoice queue.
            </p>
          </div>
        )}

        {state === "loading" && (
          <div
            className="flex flex-col items-center justify-center h-full min-h-[200px]"
            aria-busy="true"
            aria-label="Loading pending invoices"
          >
            <div
              className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"
              role="presentation"
            ></div>
            <span className="text-blue-600 font-medium">Fetching approval queue...</span>
          </div>
        )}

        {state === "empty" && (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-2xl" role="img" aria-hidden="true">
                🎉
              </span>
            </div>
            <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="text-gray-500 mt-1 max-w-sm">
              There are no pending invoices awaiting your approval at this time.
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
                  <h3 className="text-red-800 font-medium text-base">Failed to sync invoices</h3>
                  <p className="text-red-600 mt-1 text-sm">
                    Unable to connect to the internal billing service. Please verify your connection
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
                2 Pending Approvals
              </span>
              <span className="text-sm font-medium text-gray-700">Total: $12,450.00</span>
            </div>

            <ul className="space-y-3" aria-label="Pending Invoice List">
              <li
                className="p-5 border border-gray-200 rounded-lg bg-white shadow-sm hover:border-blue-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 outline-none transition-all"
                tabIndex={0}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-lg">Acme Corp Software</h4>
                    <p className="text-sm text-gray-500">Submitted by usr_abc123 • Due Oct 31</p>
                  </div>
                  <span className="text-lg font-bold text-gray-900">$1,500.00</span>
                </div>
                <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded border border-gray-100">
                  Annual SaaS subscription renewal for engineering team.
                </p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors">
                    Approve
                  </button>
                  <button className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                    Reject
                  </button>
                </div>
              </li>

              <li
                className="p-5 border border-gray-200 rounded-lg bg-white shadow-sm hover:border-blue-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 outline-none transition-all"
                tabIndex={0}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-lg">Global Logistics LLC</h4>
                    <p className="text-sm text-gray-500">Submitted by usr_def456 • Due Nov 15</p>
                  </div>
                  <span className="text-lg font-bold text-gray-900">$10,950.00</span>
                </div>
                <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded border border-gray-100">
                  Q3 Freight and shipping reconciliation.
                </p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors">
                    Approve
                  </button>
                  <button className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                    Reject
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
