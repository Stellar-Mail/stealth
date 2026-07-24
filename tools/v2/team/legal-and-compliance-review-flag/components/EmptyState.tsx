import React from "react";

export const EmptyState: React.FC = () => {
  return (
    <div role="status" className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
      <p className="text-sm font-medium text-gray-700">No review flag raised yet</p>
      <p className="mt-1 text-sm text-gray-500">
        Complete the form above to raise a legal or compliance review flag. The result will appear
        here.
      </p>
    </div>
  );
};
