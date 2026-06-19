import React from 'react';

interface TopbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar, isSidebarOpen }) => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      <button
        onClick={onToggleSidebar}
        aria-expanded={isSidebarOpen}
        aria-controls="mail-sidebar"
        aria-label={isSidebarOpen ? "Collapse navigation sidebar" : "Expand navigation sidebar"}
        className="p-2 rounded md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        ☰
      </button>

      <div className="flex items-center space-y-0 space-x-4">
        <h1 className="text-xl font-bold text-gray-800">Secure Inbox</h1>
      </div>

      <div className="flex items-center space-x-2">
        <button 
          aria-label="Trigger global secure search"
          className="p-2 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          🔍
        </button>
        <button 
          aria-label="View sender-control privacy settings"
          className="p-2 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
};
