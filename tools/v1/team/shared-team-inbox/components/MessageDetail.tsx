import React, { useState, useEffect, useCallback } from 'react';
import type { InboxService } from '../services/inbox.service';
import type { TeamMessage, Annotation } from '../types';

interface MessageDetailProps {
  message: TeamMessage;
  currentUserAddress: string;
  service: InboxService;
}

export function MessageDetail({ message, currentUserAddress, service }: MessageDetailProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationBody, setAnnotationBody] = useState('');

  const loadAnnotations = useCallback(async () => {
    const anns = await service.getAnnotations(message.id);
    setAnnotations(anns);
  }, [service, message.id]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  const handleSubmitAnnotation = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!annotationBody.trim()) return;
      await service.addAnnotation(message.id, currentUserAddress, annotationBody.trim());
      setAnnotationBody('');
      await loadAnnotations();
    },
    [annotationBody, message.id, currentUserAddress, service, loadAnnotations],
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{message.subject}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>From: {message.sender}</span>
          <span>{new Date(message.receivedAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-gray-50 p-4">
        <p className="whitespace-pre-wrap text-sm text-gray-700">{message.preview ?? 'No preview available'}</p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Internal Notes</h3>
        <div className="mb-3 space-y-2">
          {annotations.length === 0 && <p className="text-xs text-gray-400">No internal notes yet.</p>}
          {annotations.map((annotation) => (
            <div key={annotation.id} className="rounded-lg bg-yellow-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700">{annotation.author.slice(0, 12)}...</span>
                <span className="text-xs text-gray-400">{new Date(annotation.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{annotation.body}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmitAnnotation}>
          <input
            type="text"
            value={annotationBody}
            onChange={(e) => setAnnotationBody(e.target.value)}
            placeholder="Add an internal note... (Enter to submit)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            aria-label="Internal note"
          />
        </form>
      </div>
    </div>
  );
}
