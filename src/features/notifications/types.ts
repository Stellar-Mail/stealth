// src/features/notifications/types.ts

export type NotificationSeverity = 'info' | 'warning' | 'critical';
export type NotificationCTAType = 'retry' | 'inspect' | 'approve' | 'openCalendar';

export interface NotificationCTA {
  type: NotificationCTAType;
  // payload can contain any data needed for the action, e.g., ids, URLs
  payload?: Record<string, any>;
}

export interface Notification {
  id: string;
  eventId: string; // Identifier of the originating protocol event
  type: 'email' | 'mention' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
  severity?: NotificationSeverity;
  cta?: NotificationCTA;
}
