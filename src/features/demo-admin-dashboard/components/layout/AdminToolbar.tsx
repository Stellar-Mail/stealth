import React from 'react';

export interface AdminToolbarProps {
  title?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const AdminToolbar: React.FC<AdminToolbarProps> = ({ title, actions, children }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-gray-200 bg-white px-4 rounded-t-md shadow-sm">
      <div className="flex items-center gap-4">
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {children}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
};
