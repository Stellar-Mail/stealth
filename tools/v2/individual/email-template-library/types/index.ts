export const EMAIL_TEMPLATE_LIBRARY_TOOL = "email-template-library" as const;
export const EMAIL_TEMPLATE_LIBRARY_VERSION = 1 as const;

export const EMAIL_TEMPLATE_LIBRARY_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
  INVALID_TEMPLATE: "INVALID_TEMPLATE",
  TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",
  MISSING_VARIABLES: "MISSING_VARIABLES",
} as const;

export type EmailTemplateLibraryErrorCode =
  (typeof EMAIL_TEMPLATE_LIBRARY_ERROR_CODES)[keyof typeof EMAIL_TEMPLATE_LIBRARY_ERROR_CODES];

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
}

interface BaseRequest {
  tool: typeof EMAIL_TEMPLATE_LIBRARY_TOOL;
  version: typeof EMAIL_TEMPLATE_LIBRARY_VERSION;
}

export interface ListTemplatesRequest extends BaseRequest {
  operation: "list";
  categoryId?: string | null;
}

export interface GetTemplateRequest extends BaseRequest {
  operation: "get";
  templateId: string;
}

export interface RenderTemplateRequest extends BaseRequest {
  operation: "render";
  templateId: string;
  values: Record<string, string>;
}

export type EmailTemplateLibraryRequest =
  | ListTemplatesRequest
  | GetTemplateRequest
  | RenderTemplateRequest;

export interface ListTemplatesResult {
  operation: "list";
  templates: EmailTemplate[];
}

export interface GetTemplateResult {
  operation: "get";
  template: EmailTemplate;
}

export interface RenderTemplateResult {
  operation: "render";
  templateId: string;
  subject: string;
  body: string;
}

export interface EmailTemplateLibrarySuccess {
  status: "ok";
  tool: typeof EMAIL_TEMPLATE_LIBRARY_TOOL;
  version: typeof EMAIL_TEMPLATE_LIBRARY_VERSION;
  result: ListTemplatesResult | GetTemplateResult | RenderTemplateResult;
}

export interface EmailTemplateLibraryFailure {
  status: "error";
  tool: typeof EMAIL_TEMPLATE_LIBRARY_TOOL;
  version: typeof EMAIL_TEMPLATE_LIBRARY_VERSION;
  error: {
    code: EmailTemplateLibraryErrorCode;
    message: string;
    details?: { templateId?: string; fields?: string[]; missingVariables?: string[] };
  };
}

export type EmailTemplateLibraryResponse =
  | EmailTemplateLibrarySuccess
  | EmailTemplateLibraryFailure;

export interface EmailTemplateLibraryService {
  execute(request: EmailTemplateLibraryRequest): EmailTemplateLibraryResponse;
}
