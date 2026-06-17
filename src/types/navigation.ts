export interface MailNavigationState {
  isDrawerOpen: boolean;
  currentView: 'list' | 'reader' | 'compose';
  selectedFolder: string | null;
  selectedMessageId: string | null;
}
