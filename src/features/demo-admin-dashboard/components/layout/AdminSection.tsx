import React from 'react';

export interface AdminSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const AdminSection: React.FC<AdminSectionProps> = ({ title, description, children }) => {
  return (
    <section className="p-4 flex flex-col gap-4">
      {(title || description) && (
        <div className="border-b border-gray-100 pb-2 mb-2">
          {title && <h3 className="text-md font-medium text-gray-800">{title}</h3>}
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
};
