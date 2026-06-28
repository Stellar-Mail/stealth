import React from 'react';

export interface AdminPanelProps {
  children: React.ReactNode;
  className?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {children}
    </div>
  );
};
