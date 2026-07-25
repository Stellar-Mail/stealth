import type { StorageAdapter, TeamMessage, Annotation, TriageStatus } from './helpers';
import { VALID_TRANSITIONS } from './helpers';

export interface InboxService {
  getMessages(): Promise<TeamMessage[]>;
  getMessage(id: string): Promise<TeamMessage | null>;
  ingestMessage(message: TeamMessage): Promise<{ ok: boolean; error?: string }>;
  assignMessage(messageId: string, assigneeAddress: string): Promise<{ ok: boolean; error?: string }>;
  releaseAssignment(messageId: string): Promise<{ ok: boolean; error?: string }>;
  updateStatus(messageId: string, newStatus: TriageStatus): Promise<{ ok: boolean; error?: string }>;
  addAnnotation(messageId: string, author: string, body: string): Promise<Annotation>;
  deleteAnnotation(annotationId: string, author: string): Promise<{ ok: boolean; error?: string }>;
  getAnnotations(messageId: string): Promise<Annotation[]>;
}

export function createInboxService(storage: StorageAdapter): InboxService {
  const MESSAGE_PREFIX = 'msg:';
  const ANNOTATION_PREFIX = 'annotation:';

  return {
    async getMessages(): Promise<TeamMessage[]> {
      const entries = await storage.getAll<TeamMessage>(MESSAGE_PREFIX);
      return entries.map((e) => e.data);
    },

    async getMessage(id: string): Promise<TeamMessage | null> {
      const entry = await storage.get<TeamMessage>(${MESSAGE_PREFIX});
      return entry?.data ?? null;
    },

    async ingestMessage(message: TeamMessage): Promise<{ ok: boolean; error?: string }> {
      if (!message.id || !message.sender) {
        return { ok: false, error: 'Missing required fields' };
      }

      const existing = await storage.get<TeamMessage>(${MESSAGE_PREFIX});
      if (existing) {
        return { ok: false, error: 'Duplicate message' };
      }

      await storage.set(${MESSAGE_PREFIX}, { id: message.id, data: message });
      return { ok: true };
    },

    async assignMessage(messageId: string, assigneeAddress: string): Promise<{ ok: boolean; error?: string }> {
      const entry = await storage.get<TeamMessage>(${MESSAGE_PREFIX});
      if (!entry?.data) {
        return { ok: false, error: 'Message not found' };
      }

      const updatedMessage: TeamMessage = { ...entry.data };
      await storage.set(${MESSAGE_PREFIX}, { id: messageId, data: updatedMessage });

      return { ok: true };
    },

    async releaseAssignment(messageId: string): Promise<{ ok: boolean; error?: string }> {
      const entry = await storage.get<TeamMessage>(${MESSAGE_PREFIX});
      if (!entry?.data) {
        return { ok: false, error: 'Message not found' };
      }

      return { ok: true };
    },

    async updateStatus(messageId: string, newStatus: TriageStatus): Promise<{ ok: boolean; error?: string }> {
      const entry = await storage.get<TeamMessage>(${MESSAGE_PREFIX});
      if (!entry?.data) {
        return { ok: false, error: 'Message not found' };
      }

      return { ok: true };
    },

    async addAnnotation(messageId: string, author: string, body: string): Promise<Annotation> {
      const id = nnotation--;
      const annotation: Annotation = {
        id,
        messageId,
        author,
        body,
        createdAt: new Date().toISOString(),
      };

      await storage.set(${ANNOTATION_PREFIX}, { id, data: annotation });
      return annotation;
    },

    async deleteAnnotation(annotationId: string, author: string): Promise<{ ok: boolean; error?: string }> {
      const entry = await storage.get<Annotation>(${ANNOTATION_PREFIX});
      if (!entry?.data) {
        return { ok: false, error: 'Annotation not found' };
      }

      if (entry.data.author !== author) {
        return { ok: false, error: "Cannot delete another user's annotation" };
      }

      await storage.delete(${ANNOTATION_PREFIX});
      return { ok: true };
    },

    async getAnnotations(messageId: string): Promise<Annotation[]> {
      const all = await storage.getAll<Annotation>(ANNOTATION_PREFIX);
      return all
        .map((e) => e.data)
        .filter((a) => a.messageId === messageId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
  };
}
