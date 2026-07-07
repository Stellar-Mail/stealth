export interface TemplateVariable {
  key: string;
  label: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  categoryId: string | null;
  subject: string;
  body: string;
  variables: TemplateVariable[];
  tags?: string[];
  updatedAt?: string | null;
}

export interface TemplateCategory {
  id: string;
  name: string;
}

export interface TemplateRenderResult {
  subject: string;
  body: string;
  missingVariables: string[];
}
