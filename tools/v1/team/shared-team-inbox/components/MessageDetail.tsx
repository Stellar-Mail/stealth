import React, { useState, useEffect, useCallback } from 'react';
import type { InboxService } from '../services/inbox.service';
import type { SharedMessage, InternalComment, MessageStatus } from '../types';
import { getNextStatuses, STATUS_LABELS } from '../types';

interface MessageDetailProps {
  message: SharedMessage;
  currentUserAddress: string;
  teamAddresses: string[];
  service: InboxService;
  onAssign: (messageId: string) => void;
  onRelease: (messageId: string) => void;
  onStatusChange: (messageId: string, newStatus: MessageStatus) => void;
  onAddComment: (messageId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function MessageDetail({
  message,
  currentUserAddress,
  service,
  onAssign,
  onRelease,
  onStatusChange,
  onAddComment,
  onDeleteComment,
}: MessageDetailProps) {
  const [comments, setComments] = useState<InternalComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [replyBody, setReplyBody] = useState('');

  const loadComments = useCallback(async () => {
    const cmts = await service.getComments(message.id);
    setComments(cmts);
  }, [service, message.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmitComment = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!commentBody.trim()) return;
      await onAddComment(message.id, commentBody.trim());
      setCommentBody('');
      await loadComments();
    },
    [commentBody, message.id, onAddComment, loadComments],
  );

  const handleSubmitReply = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!replyBody.trim()) return;
      setReplyBody('');
      await onStatusChange(message.id, 'resolved');
    },
    [replyBody, message.id, onStatusChange],
  );

  const nextStatuses = getNextStatuses(message.status);
  const isAssignedToMe = message.assigneeAddress === currentUserAddress;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{message.subject}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>From: {message.senderAddress}</span>
          <span>{new Date(message.receivedAt).toLocaleString()}</span>
          <span
            className={ounded-full px-2 py-0.5 text-xs font-medium }
          >
            {STATUS_LABELS[message.status]}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="mb-6 rounded-lg bg-gray-50 p-4">
        <p className="whitespace-pre-wrap text-sm text-gray-700">{message.body}</p>
      </div>

      {/* Actions */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-4">
        {message.status === 'unassigned' && (
          <button
            onClick={() => onAssign(message.id)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Claim
          </button>
        )}
        {isAssignedToMe && message.status !== 'unassigned' && (
          <button
            onClick={() => onRelease(message.id)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Release
          </button>
        )}
        {nextStatuses.length > 0 && isAssignedToMe && (
          <select
            value={message.status}
            onChange={(e) => onStatusChange(message.id, e.target.value as MessageStatus)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            aria-label="Change status"
          >
            {nextStatuses.map((s) => (
              <option key={s} value={s}>
                Move to {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        )}
        {message.assigneeAddress && (
          <span className="text-xs text-gray-400">
            Assigned to: {message.assigneeAddress.slice(0, 12)}...
          </span>
        )}
      </div>

      {/* Reply */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Reply as Inbox</h3>
        <form onSubmit={handleSubmitReply}>
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Type your reply..."
            aria-label="Reply body"
          />
          <button
            type="submit"
            disabled={!replyBody.trim()}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send Reply &amp; Resolve
          </button>
        </form>
      </div>

      {/* Internal comments */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Internal Notes</h3>
        <div className="mb-3 space-y-2">
          {comments.length === 0 && (
            <p className="text-xs text-gray-400">No internal notes yet.</p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-yellow-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700">
                  {comment.author.slice(0, 12)}...
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {comment.deleted ? '[deleted]' : comment.body}
              </p>
              {!comment.deleted && comment.author === currentUserAddress && (
                <button
                  onClick={() => onDeleteComment(comment.id)}
                  className="mt-1 text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmitComment}>
          <input
            type="text"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add an internal note... (Enter to submit)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            aria-label="Internal note"
          />
        </form>
      </div>
    </div>
  );
}
