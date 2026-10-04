import React from "react";

export const EmptyState: React.FC = () => {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center"
    >
      <p className="text-lg font-medium text-foreground">No meetings to assign</p>
      <p className="mt-1 text-sm text-muted-foreground">
        There are no meetings in the queue right now. New meetings will appear here for assignment.
      </p>
    </div>
  );
};
