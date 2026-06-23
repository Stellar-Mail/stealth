export interface TemplateVariable {
  key: string;
  label: string;
  value?: string;
}

export interface EmailTemplateListItem {
  id: string;
  name: string;
  category: string;
  subject: string;
  preview: string;
  variables: TemplateVariable[];
  updatedAt: string;
  usageCount: number;
}

export interface TemplatePreviewResult {
  subject: string;
  body: string;
  missingVariables: string[];
}

export interface TemplateLibraryStats {
  totalTemplates: number;
  categories: number;
  recentlyUpdated: number;
  missingVariableTemplates: number;
}

export interface TemplateLibraryActionHandlers {
  onSelectTemplate?: (templateId: string) => void;
  onCreateTemplate?: () => void;
  onCopyTemplate?: (templateId: string) => void;
  onEditTemplate?: (templateId: string) => void;
  onRetry?: () => void;
}
