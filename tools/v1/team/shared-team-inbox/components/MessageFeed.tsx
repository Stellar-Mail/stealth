import React from 'react';
import type { TeamMessage } from '../types';

interface MessageFeedProps {
  messages: TeamMessage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MessageFeed({ messages, selectedId, onSelect }: MessageFeedProps) {
  return (
    <div className="divide-y divide-gray-200 rounded-lg border border-gray-200" role="list" aria-label="Message feed">
      {messages.map((message) => (
        <button
          key={message.id}
          onClick={() => onSelect(message.id)}
          className={w-full px-4 py-3 text-left transition hover:bg-gray-50 }
          role="listitem"
          aria-current={selectedId === message.id ? 'true' : undefined}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{message.subject}</p>
              <p className="mt-0.5 text-xs text-gray-500">{message.sender}</p>
              <p className="mt-1 truncate text-xs text-gray-400">{message.preview}</p>
            </div>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">
            {new Date(message.receivedAt).toLocaleString()}
          </p>
        </button>
      ))}
    </div>
  );
}
