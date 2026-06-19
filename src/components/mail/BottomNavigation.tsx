import React from 'react';

export const BottomNavigation: React.FC = () => {
  return (
    <nav 
      aria-label="Mobile application shortcut navigation" 
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex justify-around items-center z-30"
    >
      <button 
        aria-label="Navigate to Inbox"
        className="flex flex-col items-center justify-center w-full h-full text-blue-600 focus:outline-none focus:bg-gray-50 focus:text-blue-800"
      >
        <span className="text-xl">📥</span>
        <span className="text-xs">Inbox</span>
      </button>
      
      <button 
        aria-label="Compose new encrypted mail"
        className="flex flex-col items-center justify-center w-full h-full text-gray-600 focus:outline-none focus:bg-gray-50 focus:text-blue-600"
      >
        <span className="text-xl">✍️</span>
        <span className="text-xs">Compose</span>
      </button>

      <button 
        aria-label="View system status overview"
        className="flex flex-col items-center justify-center w-full h-full text-gray-600 focus:outline-none focus:bg-gray-50 focus:text-blue-600"
      >
        <span className="text-xl">🛡️</span>
        <span className="text-xs">Security</span>
      </button>
    </nav>
  );
};
