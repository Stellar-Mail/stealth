/**
 * Team Security Flagging Tool - Type Definitions
 * 
 * Comprehensive type system for the security flagging tool
 */

// Flag severity levels
export type FlagSeverity = 'low' | 'medium' | 'high' | 'critical';

// Flag status types
export type FlagStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

// Flag category types
export type FlagCategory = 
  | 'phishing'
  | 'malware'
  | 'spam'
  | 'data-leak'
  | 'policy-violation'
  | 'suspicious-behavior'
  | 'other';

// Main flag interface
export interface SecurityFlag {
  id: string;
  title: string;
  description: string;
  category: FlagCategory;
  severity: FlagSeverity;
  status: FlagStatus;
  messageId?: string;
  reportedBy: {
    id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
  attachments?: FlagAttachment[];
  comments?: FlagComment[];
}

// Attachment interface
export interface FlagAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

// Comment interface
export interface FlagComment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
  };
  createdAt: Date;
}

// Filter options
export interface FlagFilters {
  status?: FlagStatus[];
  severity?: FlagSeverity[];
  category?: FlagCategory[];
  assignedTo?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

// Sort options
export type FlagSortField = 'createdAt' | 'updatedAt' | 'severity' | 'title';
export type FlagSortDirection = 'asc' | 'desc';

export interface FlagSortOptions {
  field: FlagSortField;
  direction: FlagSortDirection;
}

// API response types
export interface FlagListResponse {
  flags: SecurityFlag[];
  total: number;
  page: number;
  pageSize: number;
}

// Form data types
export interface CreateFlagFormData {
  title: string;
  description: string;
  category: FlagCategory;
  severity: FlagSeverity;
  messageId?: string;
  tags?: string[];
}

export interface UpdateFlagFormData extends Partial<CreateFlagFormData> {
  status?: FlagStatus;
  assignedTo?: string;
}

// State types
export interface FlagState {
  flags: SecurityFlag[];
  selectedFlag: SecurityFlag | null;
  filters: FlagFilters;
  sort: FlagSortOptions;
  isLoading: boolean;
  error: Error | null;
}

// Action types for state management
export type FlagAction =
  | { type: 'SET_FLAGS'; payload: SecurityFlag[] }
  | { type: 'SELECT_FLAG'; payload: SecurityFlag | null }
  | { type: 'UPDATE_FILTERS'; payload: Partial<FlagFilters> }
  | { type: 'UPDATE_SORT'; payload: FlagSortOptions }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: Error | null }
  | { type: 'ADD_FLAG'; payload: SecurityFlag }
  | { type: 'UPDATE_FLAG'; payload: SecurityFlag }
  | { type: 'DELETE_FLAG'; payload: string };

// Accessibility types
export interface A11yAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
}

// Keyboard shortcut types
export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  description: string;
  action: () => void;
}
