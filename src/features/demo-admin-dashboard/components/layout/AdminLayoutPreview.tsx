import React from 'react';
import { AdminPage, AdminToolbar, AdminPanel, AdminSection } from './index';

/**
 * Preview component to validate the admin layout primitives.
 * Uses fake, deterministic data safe for public repository review.
 */
export const AdminLayoutPreview: React.FC = () => {
  return (
    <AdminPage title="Demo Data Manager">
      <AdminPanel>
        <AdminToolbar 
          title="Users (Seed Data)" 
          actions={
            <button className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700">
              Generate Mock Users
            </button>
          }
        >
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full border border-gray-200">v1.0.0</span>
        </AdminToolbar>
        
        <AdminSection title="Active Persona Profiles" description="Deterministic profiles for preview workflows.">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
              <p className="font-semibold text-sm">Alice Engineer</p>
              <p className="text-xs text-gray-500">alice@demo.stellar.mail</p>
            </div>
            <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
              <p className="font-semibold text-sm">Bob Security</p>
              <p className="text-xs text-gray-500">bob@demo.stellar.mail</p>
            </div>
          </div>
        </AdminSection>

        <AdminSection title="System Settings">
          <p className="text-sm text-gray-600">Mock settings panel for testing vertical stacking inside AdminPanels.</p>
        </AdminSection>
      </AdminPanel>
    </AdminPage>
  );
};
