import React from "react";
import type { ReviewItem } from "../types";

interface ReviewQueueItemProps {
  item: ReviewItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEscalate: (id: string) => void;
}

export const ReviewQueueItem: React.FC<ReviewQueueItemProps> = ({
  item,
  onApprove,
  onReject,
  onEscalate,
}) => {
  return (
    <li
      className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-card shadow-sm hover:shadow transition-shadow focus-within:ring-2 focus-within:ring-blue-500"
      aria-labelledby={`review-item-${item.id}-title`}
    >
      <div className="flex-1 space-y-2">
        <h3 id={`review-item-${item.id}-title`} className="text-lg font-semibold text-foreground">
          Review Request: {item.id}
        </h3>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Submitter:</span> {item.submitterId}
        </p>
        <p className="text-sm text-muted-foreground border-l-2 border-border pl-3 italic">
          "{item.contentSnippet}"
        </p>
        <div className="flex items-center gap-3 text-xs">
          <span className="bg-muted text-foreground px-2 py-1 rounded-full font-medium">
            Risk Score: {item.riskScore}
          </span>
          <time dateTime={item.submittedAt} className="text-muted-foreground">
            {new Date(item.submittedAt).toLocaleString()}
          </time>
        </div>
      </div>

      <div
        className="flex sm:flex-col gap-2 justify-center sm:justify-start"
        role="group"
        aria-label={`Actions for review item ${item.id}`}
      >
        <button
          onClick={() => onApprove(item.id)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          aria-label={`Approve request ${item.id}`}
        >
          Approve
        </button>
        <button
          onClick={() => onReject(item.id)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          aria-label={`Reject request ${item.id}`}
        >
          Reject
        </button>
        <button
          onClick={() => onEscalate(item.id)}
          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
          aria-label={`Escalate request ${item.id}`}
        >
          Escalate
        </button>
      </div>
    </li>
  );
};
