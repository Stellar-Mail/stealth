import type { StorageAdapter, SharedMessage, Assignment, InternalComment, MessageStatus } from '../types';
import { VALID_TRANSITIONS } from '../types';

export interface InboxService {
  getMessages(): Promise<SharedMessage[]>;
  getMessage(id: string): Promise<SharedMessage | null>;
  ingestMessage(message: SharedMessage): Promise<{ ok: boolean; error?: string }>;
  assignMessage(messageId: string, assigneeAddress: string): Promise<{ ok: boolean; error?: string }>;
  releaseAssignment(messageId: string): Promise<{ ok: boolean; error?: string }>;
  updateStatus(messageId: string, newStatus: MessageStatus): Promise<{ ok: boolean; error?: string }>;
  addComment(messageId: string, author: string, body: string): Promise<InternalComment>;
  deleteComment(commentId: string, author: string): Promise<{ ok: boolean; error?: string }>;
  getComments(messageId: string): Promise<InternalComment[]>;
}

export function createInboxService(storage: StorageAdapter): InboxService {
  const MESSAGE_PREFIX = 'msg:';
  const ASSIGNMENT_PREFIX = 'assign:';
  const COMMENT_PREFIX = 'comment:';

  return {
    async getMessages(): Promise<SharedMessage[]> {
      const entries = await storage.getAll<SharedMessage>(MESSAGE_PREFIX);
      return entries.map((e) => e.data);
    },

    async getMessage(id: string): Promise<SharedMessage | null> {
      const entry = await storage.get<SharedMessage>(${MESSAGE_PREFIX});
      return entry?.data ?? null;
    },

    async ingestMessage(message: SharedMessage): Promise<{ ok: boolean; error?: string }> {
      if (!message.id || !message.senderAddress || !message.deliveryProofHash) {
        return { ok: false, error: 'Missing required fields' };
      }

      const existing = await storage.get<SharedMessage>(${MESSAGE_PREFIX});
      if (existing) {
        return { ok: false, error: 'Duplicate message' };
      }

      await storage.set(${MESSAGE_PREFIX}, { id: message.id, data: message });
      return { ok: true };
    },

    async assignMessage(messageId: string, assigneeAddress: string): Promise<{ ok: boolean; error?: string }> {
      const message = await storage.get<SharedMessage>(${MESSAGE_PREFIX});
      if (!message?.data) {
        return { ok: false, error: 'Message not found' };
      }

      const assignment: Assignment = {
        messageId,
        assignedTo: assigneeAddress,
        assignedAt: new Date().toISOString(),
      };

      await storage.set(${ASSIGNMENT_PREFIX}, { id: messageId, data: assignment });

      const updatedMessage: SharedMessage = {
        ...message.data,
        status: 'claimed',
        assigneeAddress,
      };
      await storage.set(${MESSAGE_PREFIX}, { id: messageId, data: updatedMessage });

      return { ok: true };
    },

    async releaseAssignment(messageId: string): Promise<{ ok: boolean; error?: string }> {
      const message = await storage.get<SharedMessage>(${MESSAGE_PREFIX});
      if (!message?.data) {
        return { ok: false, error: 'Message not found' };
      }

      await storage.delete(${ASSIGNMENT_PREFIX});

      const updatedMessage: SharedMessage = {
        ...message.data,
        status: 'unassigned',
        assigneeAddress: undefined,
      };
      await storage.set(${MESSAGE_PREFIX}, { id: messageId, data: updatedMessage });

      return { ok: true };
    },

    async updateStatus(messageId: string, newStatus: MessageStatus): Promise<{ ok: boolean; error?: string }> {
      const message = await storage.get<SharedMessage>(${MESSAGE_PREFIX});
      if (!message?.data) {
        return { ok: false, error: 'Message not found' };
      }

      const allowed = VALID_TRANSITIONS[message.data.status] ?? [];
      if (!allowed.includes(newStatus)) {
        return { ok: false, error: Invalid transition from  to  };
      }

      const updatedMessage: SharedMessage = {
        ...message.data,
        status: newStatus,
      };
      await storage.set(${MESSAGE_PREFIX}, { id: messageId, data: updatedMessage });

      return { ok: true };
    },

    async addComment(messageId: string, author: string, body: string): Promise<InternalComment> {
      const id = comment--;
      const comment: InternalComment = {
        id,
        messageId,
        author,
        body,
        createdAt: new Date().toISOString(),
        deleted: false,
      };

      await storage.set(${COMMENT_PREFIX}, { id, data: comment });
      return comment;
    },

    async deleteComment(commentId: string, author: string): Promise<{ ok: boolean; error?: string }> {
      const entry = await storage.get<InternalComment>(${COMMENT_PREFIX});
      if (!entry?.data) {
        return { ok: false, error: 'Comment not found' };
      }

      if (entry.data.author !== author) {
        return { ok: false, error: 'Cannot delete another user\'s comment' };
      }

      const deletedComment: InternalComment = {
        ...entry.data,
        deleted: true,
        body: '[deleted]',
      };
      await storage.set(${COMMENT_PREFIX}, { id: commentId, data: deletedComment });

      return { ok: true };
    },

    async getComments(messageId: string): Promise<InternalComment[]> {
      const all = await storage.getAll<InternalComment>(COMMENT_PREFIX);
      return all
        .map((e) => e.data)
        .filter((c) => c.messageId === messageId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
  };
}
