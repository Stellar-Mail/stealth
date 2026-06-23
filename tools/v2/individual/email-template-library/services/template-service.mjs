const VARIABLE_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g;
const WHITESPACE = /\s+/g;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value, maxChars = 5000) {
  const raw = typeof value === "string" ? value : "";
  const cleaned = raw.replace(WHITESPACE, " ").trim();
  return cleaned.length <= maxChars ? cleaned : cleaned.slice(0, maxChars).trimEnd();
}

function cloneTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    categoryId: template.categoryId ?? null,
    subject: template.subject,
    body: template.body,
    variables: template.variables.map((variable) => ({ ...variable })),
  };
}

function normalizeVariable(variable) {
  if (!isPlainObject(variable)) return null;
  const key = cleanString(variable.key, 80);
  const label = cleanString(variable.label ?? variable.key, 120);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) return null;
  return { key, label: label || key };
}

export function extractTemplateVariables(...parts) {
  const found = [];
  for (const part of parts) {
    const text = typeof part === "string" ? part : "";
    for (const match of text.matchAll(VARIABLE_PATTERN)) {
      found.push(match[1]);
    }
  }
  return [...new Set(found)];
}

export function validateTemplate(template) {
  if (!isPlainObject(template)) return ["template must be an object"];

  const errors = [];
  if (!cleanString(template.id, 120)) errors.push("id is required");
  if (!cleanString(template.name, 160)) errors.push("name is required");
  if (template.categoryId !== null && template.categoryId !== undefined && typeof template.categoryId !== "string") {
    errors.push("categoryId must be a string or null");
  }
  if (typeof template.subject !== "string") errors.push("subject must be a string");
  if (typeof template.body !== "string") errors.push("body must be a string");
  if (!Array.isArray(template.variables)) errors.push("variables must be an array");

  if (Array.isArray(template.variables)) {
    const keys = template.variables.map((variable) => normalizeVariable(variable)?.key).filter(Boolean);
    if (keys.length !== template.variables.length) errors.push("variables must have valid keys");
    if (new Set(keys).size !== keys.length) errors.push("variable keys must be unique");
  }

  return errors;
}

export function normalizeTemplate(template) {
  const errors = validateTemplate(template);
  if (errors.length > 0) {
    return { ok: false, errors, value: null };
  }

  const subject = cleanString(template.subject, 500);
  const body = cleanString(template.body, 8000);
  const declaredVariables = template.variables.map((variable) => normalizeVariable(variable));
  const placeholderKeys = extractTemplateVariables(subject, body);
  const declaredKeys = new Set(declaredVariables.map((variable) => variable.key));
  const missingDeclarations = placeholderKeys.filter((key) => !declaredKeys.has(key));
  const variables = [
    ...declaredVariables,
    ...missingDeclarations.map((key) => ({ key, label: key })),
  ];

  return {
    ok: true,
    errors: [],
    value: {
      id: cleanString(template.id, 120),
      name: cleanString(template.name, 160),
      categoryId: template.categoryId ? cleanString(template.categoryId, 120) : null,
      subject,
      body,
      variables,
    },
  };
}

function renderText(text, values, missing) {
  return text.replace(VARIABLE_PATTERN, (_match, key) => {
    const value = values?.[key];
    if (value === undefined || value === null || value === "") {
      missing.add(key);
      return `{{${key}}}`;
    }
    return cleanString(String(value), 1000);
  });
}

export function createTemplateService(config = {}) {
  const initialTemplates = Array.isArray(config.initialTemplates) ? config.initialTemplates : [];
  const categories = Array.isArray(config.categories) ? config.categories.map((category) => ({ ...category })) : [];
  let templates = initialTemplates.map((template) => normalizeTemplate(template)).filter((result) => result.ok).map((result) => result.value);

  function listTemplates() {
    return templates.map(cloneTemplate);
  }

  function listCategories() {
    return categories.map((category) => ({ ...category }));
  }

  function getTemplate(id) {
    const template = templates.find((item) => item.id === id);
    return template ? cloneTemplate(template) : null;
  }

  function saveTemplate(template) {
    const normalized = normalizeTemplate(template);
    if (!normalized.ok) {
      return { ok: false, errors: normalized.errors, template: null };
    }

    const next = normalized.value;
    const index = templates.findIndex((item) => item.id === next.id);
    templates = index === -1
      ? [...templates, next]
      : templates.map((item, itemIndex) => (itemIndex === index ? next : item));

    return { ok: true, errors: [], template: cloneTemplate(next) };
  }

  function deleteTemplate(id) {
    const exists = templates.some((item) => item.id === id);
    templates = templates.filter((item) => item.id !== id);
    return { ok: exists, deleted: exists };
  }

  function searchTemplates(query, options = {}) {
    const normalizedQuery = cleanString(query, 200).toLowerCase();
    const categoryId = options.categoryId ?? null;
    let result = templates;

    if (categoryId) result = result.filter((template) => template.categoryId === categoryId);
    if (normalizedQuery) {
      result = result.filter((template) => {
        return [template.name, template.subject, template.body, template.categoryId ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });
    }

    return result.map(cloneTemplate);
  }

  function renderTemplate(id, values = {}) {
    const template = templates.find((item) => item.id === id);
    if (!template) {
      return {
        ok: false,
        errors: [`template ${id} not found`],
        subject: "",
        body: "",
        missingVariables: [],
      };
    }

    const missing = new Set();
    const subject = renderText(template.subject, values, missing);
    const body = renderText(template.body, values, missing);

    return {
      ok: true,
      errors: [],
      subject,
      body,
      missingVariables: [...missing],
    };
  }

  return {
    listTemplates,
    listCategories,
    getTemplate,
    saveTemplate,
    deleteTemplate,
    searchTemplates,
    renderTemplate,
  };
}
