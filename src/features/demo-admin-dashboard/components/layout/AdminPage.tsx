import React from 'react';

export interface AdminPageProps {
  children: React.ReactNode;
  title?: string;
}

export const AdminPage: React.FC<AdminPageProps> = ({ children, title }) => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 flex flex-col gap-6">
      {title && (
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </header>
      )}
      <main className="flex-1 flex flex-col gap-6">
        {children}
      </main>
    </div>
  );
};
