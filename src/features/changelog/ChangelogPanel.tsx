import React from 'react';
import { useChangelog } from './useChangelog';

interface ChangelogPanelProps {
  isLoading?: boolean;
}

export const ChangelogPanel: React.FC<ChangelogPanelProps> = ({ isLoading = false }) => {
  const { isOpen, setIsOpen, groupedEntries, unreadCount, readEntries, markAsRead } = useChangelog();

  if (!isOpen) {
    return (
      <button 
        className="relative p-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        onClick={() => setIsOpen(true)}
      >
        Changelog
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-blue-600 rounded-full" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">Release Log</h2>
        <button 
          className="text-gray-500 hover:text-gray-700 text-sm"
          onClick={() => setIsOpen(false)}
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          // Array size pre-allocated to prevent loop recalculations during loading
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))
        ) : groupedEntries.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No release entries found.</p>
        ) : (
          groupedEntries.map((entry) => (
            <div 
              key={entry.id}
              className={`p-3 rounded-lg border transition-colors ${
                readEntries.has(entry.id) ? 'bg-white border-gray-100' : 'bg-blue-50/50 border-blue-100'
              }`}
              onMouseEnter={() => markAsRead(entry.id)}
            >
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs font-mono text-gray-500">{entry.date}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {entry.version}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">{entry.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{entry.summary}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
