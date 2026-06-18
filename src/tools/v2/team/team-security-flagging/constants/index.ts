/**
 * Team Security Flagging Tool - Constants
 * 
 * Centralized constants for the security flagging tool
 */

import type { FlagCategory, FlagSeverity, FlagStatus } from '../types';

// Severity metadata
export const SEVERITY_META: Record<FlagSeverity, {
  label: string;
  color: string;
  description: string;
  icon: string;
}> = {
  low: {
    label: 'Low',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description: 'Minor concern requiring attention',
    icon: 'info',
  },
  medium: {
    label: 'Medium',
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    description: 'Moderate security concern',
    icon: 'alert-triangle',
  },
  high: {
    label: 'High',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    description: 'Serious security risk',
    icon: 'alert-circle',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-600 bg-red-50 border-red-200',
    description: 'Immediate action required',
    icon: 'alert-octagon',
  },
};

// Status metadata
export const STATUS_META: Record<FlagStatus, {
  label: string;
  color: string;
  description: string;
}> = {
  pending: {
    label: 'Pending',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    description: 'Awaiting review',
  },
  reviewing: {
    label: 'Reviewing',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description: 'Currently under investigation',
  },
  resolved: {
    label: 'Resolved',
    color: 'text-green-600 bg-green-50 border-green-200',
    description: 'Issue has been resolved',
  },
  dismissed: {
    label: 'Dismissed',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    description: 'False positive or not actionable',
  },
};

// Category metadata
export const CATEGORY_META: Record<FlagCategory, {
  label: string;
  description: string;
  icon: string;
}> = {
  phishing: {
    label: 'Phishing',
    description: 'Suspected phishing attempt',
    icon: 'fish',
  },
  malware: {
    label: 'Malware',
    description: 'Potential malware or malicious content',
    icon: 'bug',
  },
  spam: {
    label: 'Spam',
    description: 'Unsolicited or bulk messages',
    icon: 'mail-x',
  },
  'data-leak': {
    label: 'Data Leak',
    description: 'Exposure of sensitive information',
    icon: 'shield-alert',
  },
  'policy-violation': {
    label: 'Policy Violation',
    description: 'Breach of organizational policies',
    icon: 'file-warning',
  },
  'suspicious-behavior': {
    label: 'Suspicious Behavior',
    description: 'Unusual or anomalous activity',
    icon: 'eye',
  },
  other: {
    label: 'Other',
    description: 'Other security concerns',
    icon: 'help-circle',
  },
};

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  SEARCH: '/',
  NEW_FLAG: 'n',
  CLOSE_DIALOG: 'Escape',
  NAVIGATE_NEXT: 'j',
  NAVIGATE_PREV: 'k',
  OPEN_SELECTED: 'Enter',
  TOGGLE_FILTERS: 'f',
  REFRESH: 'r',
} as const;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Date formats
export const DATE_FORMAT = 'MMM d, yyyy';
export const DATE_TIME_FORMAT = 'MMM d, yyyy h:mm a';

// ARIA labels
export const ARIA_LABELS = {
  flagList: 'Security flags list',
  flagDetail: 'Flag details',
  flagForm: 'Flag form',
  filters: 'Filter controls',
  searchInput: 'Search flags',
  sortButton: 'Sort options',
  createButton: 'Create new flag',
  closeButton: 'Close',
  deleteButton: 'Delete flag',
  updateButton: 'Update flag',
  cancelButton: 'Cancel',
  nextPage: 'Next page',
  prevPage: 'Previous page',
  severitySelect: 'Select severity level',
  statusSelect: 'Select status',
  categorySelect: 'Select category',
} as const;

// Screen reader announcements
export const SR_ANNOUNCEMENTS = {
  flagCreated: (title: string) => `Flag "${title}" created successfully`,
  flagUpdated: (title: string) => `Flag "${title}" updated successfully`,
  flagDeleted: (title: string) => `Flag "${title}" deleted successfully`,
  filtersApplied: (count: number) => `${count} flag${count !== 1 ? 's' : ''} found`,
  loadingFlags: 'Loading flags',
  loadingComplete: 'Flags loaded',
  error: (message: string) => `Error: ${message}`,
  noResults: 'No flags found matching your criteria',
} as const;

// Form validation messages
export const VALIDATION_MESSAGES = {
  titleRequired: 'Title is required',
  titleTooShort: 'Title must be at least 3 characters',
  titleTooLong: 'Title must not exceed 100 characters',
  descriptionRequired: 'Description is required',
  descriptionTooShort: 'Description must be at least 10 characters',
  categoryRequired: 'Category is required',
  severityRequired: 'Severity is required',
} as const;

// API endpoints (mock for now)
export const API_ENDPOINTS = {
  flags: '/api/v2/security-flags',
  flag: (id: string) => `/api/v2/security-flags/${id}`,
  flagComments: (id: string) => `/api/v2/security-flags/${id}/comments`,
  flagAttachments: (id: string) => `/api/v2/security-flags/${id}/attachments`,
} as const;
