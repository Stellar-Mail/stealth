import {
  EMAIL_TEMPLATE_LIBRARY_ERROR_CODES,
  EMAIL_TEMPLATE_LIBRARY_TOOL,
  EMAIL_TEMPLATE_LIBRARY_VERSION,
} from "../types/index.ts";
import type {
  EmailTemplate,
  EmailTemplateLibraryFailure,
  EmailTemplateLibraryRequest,
  EmailTemplateLibraryResponse,
  EmailTemplateLibraryService,
} from "../types/index.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(
  code: EmailTemplateLibraryFailure["error"]["code"],
  message: string,
  details?: EmailTemplateLibraryFailure["error"]["details"],
): EmailTemplateLibraryFailure {
  return {
    status: "error",
    tool: EMAIL_TEMPLATE_LIBRARY_TOOL,
    version: EMAIL_TEMPLATE_LIBRARY_VERSION,
    error: { code, message, ...(details ? { details } : {}) },
  };
}

function cloneTemplate(template: EmailTemplate): EmailTemplate {
  return { ...template, variables: template.variables.map((variable) => ({ ...variable })) };
}

function validateTemplate(value: unknown): string[] {
  if (!isRecord(value)) return ["id", "name", "categoryId", "subject", "body", "variables"];
  const fields: string[] = [];
  if (typeof value.id !== "string" || value.id.trim() === "") fields.push("id");
  if (typeof value.name !== "string" || value.name.trim() === "") fields.push("name");
  if (!(typeof value.categoryId === "string" || value.categoryId === null))
    fields.push("categoryId");
  if (typeof value.subject !== "string") fields.push("subject");
  if (typeof value.body !== "string") fields.push("body");
  if (
    !Array.isArray(value.variables) ||
    value.variables.some(
      (variable) =>
        !isRecord(variable) ||
        typeof variable.key !== "string" ||
        variable.key.trim() === "" ||
        typeof variable.label !== "string" ||
        variable.label.trim() === "",
    )
  )
    fields.push("variables");
  return fields;
}

export function createEmailTemplateLibraryService(
  sourceTemplates: readonly EmailTemplate[],
): EmailTemplateLibraryService {
  const templates = sourceTemplates.map((template) => cloneTemplate(template));
  const invalidTemplate = templates.find((template) => validateTemplate(template).length > 0);
  if (invalidTemplate) {
    throw new Error(`Invalid email template catalog entry: ${invalidTemplate.id || "unknown"}`);
  }

  return { execute: (request) => executeEmailTemplateLibrary(request, templates) };
}

export function executeEmailTemplateLibrary(
  request: EmailTemplateLibraryRequest,
  sourceTemplates: readonly EmailTemplate[],
): EmailTemplateLibraryResponse {
  if (!isRecord(request) || request.tool !== EMAIL_TEMPLATE_LIBRARY_TOOL) {
    return failure(
      EMAIL_TEMPLATE_LIBRARY_ERROR_CODES.INVALID_REQUEST,
      "The request must be an email-template-library request object.",
    );
  }
  if (request.version !== EMAIL_TEMPLATE_LIBRARY_VERSION) {
    return failure(
      EMAIL_TEMPLATE_LIBRARY_ERROR_CODES.UNSUPPORTED_VERSION,
      `Unsupported email-template-library version ${String(request.version)}.`,
    );
  }

  for (const template of sourceTemplates) {
    const fields = validateTemplate(template);
    if (fields.length > 0) {
      return failure(
        EMAIL_TEMPLATE_LIBRARY_ERROR_CODES.INVALID_TEMPLATE,
        "The template catalog contains an invalid template.",
        {
          templateId:
            isRecord(template) && typeof template.id === "string" ? template.id : undefined,
          fields,
        },
      );
    }
  }

  if (request.operation === "list") {
    if (
      !(
        request.categoryId === undefined ||
        request.categoryId === null ||
        typeof request.categoryId === "string"
      )
    ) {
      return failure(
        EMAIL_TEMPLATE_LIBRARY_ERROR_CODES.INVALID_REQUEST,
        "categoryId must be a string or null.",
      );
    }
    const matches =
      request.categoryId === undefined
        ? sourceTemplates
        : sourceTemplates.filter((template) => template.categoryId === request.categoryId);
    return {
      status: "ok",
      tool: EMAIL_TEMPLATE_LIBRARY_TOOL,
      version: EMAIL_TEMPLATE_LIBRARY_VERSION,
      result: { operation: "list", templates: matches.map(cloneTemplate) },
    };
  }

  if (
    (request.operation !== "get" && request.operation !== "render") ||
    typeof request.templateId !== "string" ||
    request.templateId.trim() === ""
  ) {
    return failure(
      EMAIL_TEMPLATE_LIBRARY_ERROR_CODES.INVALID_REQUEST,
      "A supported operation and non-empty templateId are required.",
    );
  }
  const template = sourceTemplates.find((candidate) => candidate.id === request.templateId);
  if (!template) {
    return failure(
      EMAIL_TEMPLATE_LIBRARY_ERROR_CODES.TEMPLATE_NOT_FOUND,
      `Template ${request.templateId} was not found.`,
      { templateId: request.templateId },
    );
  }
  if (request.operation === "get") {
    return {
      status: "ok",
      tool: EMAIL_TEMPLATE_LIBRARY_TOOL,
      version: EMAIL_TEMPLATE_LIBRARY_VERSION,
      result: { operation: "get", template: cloneTemplate(template) },
    };
  }
  if (
    !isRecord(request.values) ||
    Object.values(request.values).some((value) => typeof value !== "string")
  ) {
    return failure(
      EMAIL_TEMPLATE_LIBRARY_ERROR_CODES.INVALID_REQUEST,
      "Render values must be a string map.",
    );
  }
  const missingVariables = template.variables
    .map(({ key }) => key)
    .filter((key) => !(key in request.values));
  if (missingVariables.length > 0) {
    return failure(
      EMAIL_TEMPLATE_LIBRARY_ERROR_CODES.MISSING_VARIABLES,
      "Values are required for every declared template variable.",
      { templateId: template.id, missingVariables },
    );
  }
  const substitute = (text: string) =>
    text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) =>
      Object.prototype.hasOwnProperty.call(request.values, key) ? request.values[key] : match,
    );
  return {
    status: "ok",
    tool: EMAIL_TEMPLATE_LIBRARY_TOOL,
    version: EMAIL_TEMPLATE_LIBRARY_VERSION,
    result: {
      operation: "render",
      templateId: template.id,
      subject: substitute(template.subject),
      body: substitute(template.body),
    },
  };
}
