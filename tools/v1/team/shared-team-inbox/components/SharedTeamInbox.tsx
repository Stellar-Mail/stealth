import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createMemoryStorageAdapter } from '../storage/memory-adapter';
import { createInboxService, type InboxService } from '../services/inbox.service';
import type { TeamMessage, TriageStatus } from '../types';
import { STATUS_LABELS } from '../services/helpers';
import { MessageFeed } from './MessageFeed';
import { MessageDetail } from './MessageDetail';

interface SharedTeamInboxProps {
  currentUserAddress: string;
  teamAddresses: string[];
}

export function SharedTeamInbox({ currentUserAddress, teamAddresses }: SharedTeamInboxProps) {
  const [service] = useState<InboxService>(() => createInboxService(createMemoryStorageAdapter()));
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TriageStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const msgs = await service.getMessages();
      setMessages(msgs);
    } catch {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const filteredMessages = useMemo(() => {
    if (statusFilter === 'all') return messages;
    return messages;
  }, [messages, statusFilter]);

  const selectedMessage = useMemo(() => {
    if (!selectedId) return null;
    return messages.find((m) => m.id === selectedId) ?? null;
  }, [messages, selectedId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <p className="text-gray-500">Loading shared inbox...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="alert">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadMessages}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Shared Team Inbox</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TriageStatus | 'all')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="all">All messages</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filteredMessages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16">
          <p className="text-gray-500">No messages found</p>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="w-80 flex-shrink-0">
            <MessageFeed messages={filteredMessages} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <div className="flex-1">
            {selectedMessage ? (
              <MessageDetail
                message={selectedMessage}
                currentUserAddress={currentUserAddress}
                service={service}
              />
            ) : (
              <div className="flex items-center justify-center py-16">
                <p className="text-gray-400">Select a message to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
