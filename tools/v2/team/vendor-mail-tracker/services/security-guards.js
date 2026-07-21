const MAX_TEXT_LENGTH = 200;
const MAX_COLLECTION_SIZE = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>/\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeText(value, options = {}) {
  const fallback = options.fallback ?? "";
  const normalized = normalizeText(value, fallback);
  const maxLength = options.maxLength ?? MAX_TEXT_LENGTH;

  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength).trimEnd();
  }

  return normalized;
}

export function sanitizeVendorInput(input) {
  const email = sanitizeText(input.email, { maxLength: 120, fallback: "" }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    return { valid: false, reason: "invalid_email" };
  }

  const name = sanitizeText(input.name, { maxLength: 80, fallback: "" });
  if (!name) {
    return { valid: false, reason: "invalid_name" };
  }

  const category = sanitizeText(input.category, { maxLength: 40, fallback: "other" });
  const allowedCategories = new Set([
    "email-service",
    "communication",
    "business",
    "marketplace",
    "other",
  ]);
  if (!allowedCategories.has(category)) {
    return { valid: false, reason: "invalid_category" };
  }

  return {
    valid: true,
    value: {
      name,
      email,
      category,
    },
  };
}

export function clampCollection(items, limit = MAX_COLLECTION_SIZE) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : MAX_COLLECTION_SIZE;
  return items.slice(0, safeLimit);
}

export function createSafeRecord(input) {
  const safeRecord = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      safeRecord[key] = sanitizeText(value, { maxLength: MAX_TEXT_LENGTH, fallback: "" });
      continue;
    }

    if (typeof value === "object") {
      if (Array.isArray(value)) {
        safeRecord[key] = clampCollection(value, MAX_COLLECTION_SIZE);
      } else {
        const nested = Object.entries(value).reduce((acc, [nestedKey, nestedValue]) => {
          if (typeof nestedValue === "symbol") {
            return acc;
          }
          acc[nestedKey] = nestedValue;
          return acc;
        }, {});
        safeRecord[key] = nested;
      }
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      safeRecord[key] = value;
    }
  }

  return safeRecord;
}
