/**
 * Email Template Library - Core Service
 *
 * Folder-local, dependency-free template CRUD, search, and rendering logic.
 * No main app integration, persistence, network calls, or production data.
 */

export class EmailTemplateLibraryError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = "EmailTemplateLibraryError";
    this.field = field;
  }
}

export const LIMITS = Object.freeze({
  MAX_ID_LENGTH: 100,
  MAX_NAME_LENGTH: 120,
  MAX_SUBJECT_LENGTH: 300,
  MAX_BODY_LENGTH: 8000,
  MAX_VARIABLES: 30,
  MAX_TAGS: 16,
  MAX_TAG_LENGTH: 64,
  MAX_TEMPLATES: 200,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
});

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "is", "of", "on", "or", "the", "to"]);

export function sanitizeText(value, maxLength = LIMITS.MAX_BODY_LENGTH) {
  if (typeof value !== "string") return "";
  const sanitized = value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim();
  return sanitized.length > maxLength ? sanitized.slice(0, maxLength).trim() : sanitized;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateId(value, field) {
  const id = sanitizeText(value, LIMITS.MAX_ID_LENGTH);
  if (!id) throw new EmailTemplateLibraryError(`${field} is required`, field);
  if (!ID_PATTERN.test(id)) {
    throw new EmailTemplateLibraryError(`${field} contains invalid characters`, field);
  }
  return id;
}

function tokenize(value) {
  return [
    ...new Set(
      sanitizeText(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
    ),
  ];
}

export function extractTemplateVariables(subject = "", body = "") {
  const combined = `${subject} ${body}`;
  const keys = new Set();
  let match;
  while ((match = VARIABLE_PATTERN.exec(combined)) !== null) {
    keys.add(match[1]);
  }
  return [...keys].sort();
}

export function validateTemplateVariable(variable) {
  if (variable === null || typeof variable !== "object" || Array.isArray(variable)) {
    throw new EmailTemplateLibraryError("variable must be a plain object", "variables");
  }
  const key = validateId(variable.key, "variable.key");
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
    throw new EmailTemplateLibraryError("variable key must start with a letter", "variable.key");
  }
  const label = sanitizeText(variable.label, LIMITS.MAX_NAME_LENGTH);
  if (!label) throw new EmailTemplateLibraryError("variable label is required", "variable.label");
  return { key, label };
}

function validateTags(tags) {
  if (tags === undefined || tags === null) return [];
  if (!Array.isArray(tags)) {
    throw new EmailTemplateLibraryError("tags must be an array", "tags");
  }
  if (tags.length > LIMITS.MAX_TAGS) {
    throw new EmailTemplateLibraryError(`tags exceeds ${LIMITS.MAX_TAGS} items`, "tags");
  }
  return tags.map((tag, index) => {
    const sanitized = sanitizeText(tag, LIMITS.MAX_TAG_LENGTH).toLowerCase();
    if (!sanitized) throw new EmailTemplateLibraryError(`tags[${index}] is required`, "tags");
    return sanitized;
  });
}

export function validateCategory(category) {
  if (category === null || typeof category !== "object" || Array.isArray(category)) {
    throw new EmailTemplateLibraryError("category must be a plain object", "category");
  }
  const id = validateId(category.id, "category.id");
  const name = sanitizeText(category.name, LIMITS.MAX_NAME_LENGTH);
  if (!name) throw new EmailTemplateLibraryError("category name is required", "category.name");
  return { id, name };
}

export function validateTemplate(template) {
  if (template === null || typeof template !== "object" || Array.isArray(template)) {
    throw new EmailTemplateLibraryError("template must be a plain object", "template");
  }
  const id = validateId(template.id, "template.id");
  const name = sanitizeText(template.name, LIMITS.MAX_NAME_LENGTH);
  if (!name) throw new EmailTemplateLibraryError("template name is required", "template.name");
  const categoryId =
    template.categoryId === undefined || template.categoryId === null || template.categoryId === ""
      ? null
      : validateId(template.categoryId, "template.categoryId");
  const subject = sanitizeText(template.subject, LIMITS.MAX_SUBJECT_LENGTH);
  const body = sanitizeText(template.body, LIMITS.MAX_BODY_LENGTH);
  if (!subject) throw new EmailTemplateLibraryError("template subject is required", "subject");
  if (!body) throw new EmailTemplateLibraryError("template body is required", "body");

  const variables = Array.isArray(template.variables) ? template.variables : [];
  if (variables.length > LIMITS.MAX_VARIABLES) {
    throw new EmailTemplateLibraryError(
      `variables exceeds ${LIMITS.MAX_VARIABLES} items`,
      "variables",
    );
  }
  const validatedVariables = variables.map(validateTemplateVariable);
  const declared = new Set(validatedVariables.map((variable) => variable.key));
  const placeholders = extractTemplateVariables(subject, body);
  for (const placeholder of placeholders) {
    if (!declared.has(placeholder)) {
      throw new EmailTemplateLibraryError(
        `placeholder "${placeholder}" is not declared in variables`,
        "variables",
      );
    }
  }

  return {
    id,
    name,
    categoryId,
    subject,
    body,
    variables: validatedVariables,
    tags: validateTags(template.tags),
    updatedAt: sanitizeText(template.updatedAt, 40) || null,
  };
}

export function renderTemplateContent(templateInput, values = {}) {
  const template = validateTemplate(templateInput);
  const safeValues = values && typeof values === "object" && !Array.isArray(values) ? values : {};
  const missingVariables = [];

  function replaceVariables(text) {
    return text.replace(VARIABLE_PATTERN, (_match, key) => {
      const value = safeValues[key];
      if (value === undefined || value === null || String(value).length === 0) {
        if (!missingVariables.includes(key)) missingVariables.push(key);
        return "";
      }
      return sanitizeText(String(value), LIMITS.MAX_BODY_LENGTH);
    }).replace(/\s+/g, " ").trim();
  }

  return {
    subject: replaceVariables(template.subject),
    body: replaceVariables(template.body),
    missingVariables: missingVariables.sort(),
  };
}

export function scoreTemplate(templateInput, query = "", categoryLookup = new Map()) {
  const template = validateTemplate(templateInput);
  const terms = tokenize(query);
  if (terms.length === 0) return 0;

  const categoryName = template.categoryId ? categoryLookup.get(template.categoryId) ?? "" : "";
  const buckets = [
    { weight: 5, tokens: new Set(tokenize(template.name)) },
    { weight: 4, tokens: new Set(tokenize(template.subject)) },
    { weight: 3, tokens: new Set(template.tags.flatMap(tokenize)) },
    { weight: 2, tokens: new Set(tokenize(categoryName)) },
    { weight: 1, tokens: new Set(tokenize(template.body)) },
  ];

  let score = 0;
  for (const term of terms) {
    for (const bucket of buckets) {
      if (bucket.tokens.has(term)) score += bucket.weight;
    }
  }
  return score;
}

export function createLoadingState(query = "") {
  return {
    status: "loading",
    isLoading: true,
    error: null,
    query: sanitizeText(query, LIMITS.MAX_SUBJECT_LENGTH),
    templates: [],
    totalCount: 0,
  };
}

export function createEmptyState(query = "") {
  return {
    status: "empty",
    isLoading: false,
    error: null,
    query: sanitizeText(query, LIMITS.MAX_SUBJECT_LENGTH),
    templates: [],
    totalCount: 0,
  };
}

export function createErrorState(error, query = "") {
  return {
    status: "error",
    isLoading: false,
    error: {
      message: error instanceof Error ? error.message : String(error),
      field: error instanceof EmailTemplateLibraryError ? error.field : null,
    },
    query: sanitizeText(query, LIMITS.MAX_SUBJECT_LENGTH),
    templates: [],
    totalCount: 0,
  };
}

export function createTemplateListState(input = {}, templates = [], categories = []) {
  try {
    const query = sanitizeText(input.query, LIMITS.MAX_SUBJECT_LENGTH);
    const categoryId =
      input.categoryId === undefined || input.categoryId === null || input.categoryId === ""
        ? null
        : validateId(input.categoryId, "categoryId");
    const limit =
      input.limit === undefined ? LIMITS.DEFAULT_LIMIT : Number.parseInt(String(input.limit), 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > LIMITS.MAX_LIMIT) {
      throw new EmailTemplateLibraryError(`limit must be between 1 and ${LIMITS.MAX_LIMIT}`, "limit");
    }

    const validCategories = categories.map(validateCategory);
    const categoryLookup = new Map(validCategories.map((category) => [category.id, category.name]));
    let validTemplates = templates.map(validateTemplate);

    if (categoryId) validTemplates = validTemplates.filter((template) => template.categoryId === categoryId);
    if (query) {
      validTemplates = validTemplates
        .map((template) => ({
          template,
          score: scoreTemplate(template, query, categoryLookup),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.template.name.localeCompare(b.template.name);
        })
        .map((entry) => entry.template);
    } else {
      validTemplates = validTemplates.sort((a, b) => a.name.localeCompare(b.name));
    }

    const sliced = validTemplates.slice(0, limit);
    if (sliced.length === 0) {
      return { ...createEmptyState(query), totalCount: validTemplates.length };
    }

    return {
      status: "success",
      isLoading: false,
      error: null,
      query,
      templates: clone(sliced),
      totalCount: validTemplates.length,
    };
  } catch (error) {
    return createErrorState(error, input?.query ?? "");
  }
}

export function createTemplateService(initial = {}) {
  let templates = (initial.templates ?? []).map(validateTemplate);
  let categories = (initial.categories ?? []).map(validateCategory);

  if (templates.length > LIMITS.MAX_TEMPLATES) {
    throw new EmailTemplateLibraryError(
      `templates exceeds ${LIMITS.MAX_TEMPLATES} items`,
      "templates",
    );
  }

  function getCategoryIds() {
    return new Set(categories.map((category) => category.id));
  }

  function ensureCategoryExists(template) {
    if (template.categoryId && !getCategoryIds().has(template.categoryId)) {
      throw new EmailTemplateLibraryError(
        `unknown categoryId: ${template.categoryId}`,
        "categoryId",
      );
    }
  }

  for (const template of templates) ensureCategoryExists(template);

  return {
    getTemplates() {
      return clone(templates);
    },
    getCategories() {
      return clone(categories);
    },
    getTemplate(id) {
      const safeId = validateId(id, "id");
      const template = templates.find((entry) => entry.id === safeId);
      return template ? clone(template) : null;
    },
    saveTemplate(templateInput) {
      const template = validateTemplate(templateInput);
      ensureCategoryExists(template);
      const index = templates.findIndex((entry) => entry.id === template.id);
      if (index === -1) templates = [...templates, template];
      else templates = [...templates.slice(0, index), template, ...templates.slice(index + 1)];
      return clone(template);
    },
    deleteTemplate(id) {
      const safeId = validateId(id, "id");
      const before = templates.length;
      templates = templates.filter((template) => template.id !== safeId);
      return before !== templates.length;
    },
    searchTemplates(input = {}) {
      return createTemplateListState(input, templates, categories);
    },
    renderTemplate(id, values = {}) {
      const template = this.getTemplate(id);
      if (!template) throw new EmailTemplateLibraryError(`template not found: ${id}`, "id");
      return renderTemplateContent(template, values);
    },
  };
}
