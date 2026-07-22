import React from "react";

export const EmptyState: React.FC = () => {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center"
    >
      <p className="text-lg font-medium text-gray-900">No meetings to assign</p>
      <p className="mt-1 text-sm text-gray-500">
        There are no meetings in the queue right now. New meetings will appear here for assignment.
      </p>
    </div>
  );
};
