import React from "react";
import type { ReviewItem } from "../types";
import { ReviewQueueItem } from "./ReviewQueueItem";

interface ReviewQueueListProps {
  items: ReviewItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEscalate: (id: string) => void;
}

export const ReviewQueueList: React.FC<ReviewQueueListProps> = ({
  items,
  onApprove,
  onReject,
  onEscalate,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto" role="region" aria-label="Review Queue Items">
      <ul className="space-y-4 m-0 p-0 list-none">
        {items.map((item) => (
          <ReviewQueueItem
            key={item.id}
            item={item}
            onApprove={onApprove}
            onReject={onReject}
            onEscalate={onEscalate}
          />
        ))}
      </ul>
    </div>
  );
};
