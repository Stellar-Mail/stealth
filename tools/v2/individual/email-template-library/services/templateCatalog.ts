/**
 * Email template catalog validation core (#490).
 *
 * The existing service validates each template in isolation and renders by
 * substituting {{variable}} tokens. It does not enforce catalog-level
 * invariants that a robust template library needs:
 *   - Template IDs must be unique across the catalog (duplicate IDs would make
 *     get/render ambiguous).
 *   - Each template's variable `key`s must be unique within that template
 *     (duplicate keys make substitution order-dependent and confusing).
 *   - `categoryId` references, when present, should point at a known category
 *     so list-by-category cannot silently return nothing.
 *
 * This pure, folder-local module provides that cross-template validation. It
 * performs no I/O, no network, and imports only folder-local types. It is
 * deterministic and safe to run at service construction time.
 */

import type { EmailTemplate } from "../types";

export interface CatalogValidationIssue {
  templateId?: string;
  code: "DUPLICATE_TEMPLATE_ID" | "DUPLICATE_VARIABLE_KEY" | "UNKNOWN_CATEGORY";
  message: string;
}

export interface CatalogValidationResult {
  ok: boolean;
  issues: CatalogValidationIssue[];
}

const VARIABLE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/**
 * Validate a template catalog as a whole.
 *
 * @param templates  The full catalog of templates.
 * @param knownCategoryIds  Optional set of valid category ids for referential
 *   integrity checks on `categoryId`. When omitted, category checks are skipped.
 */
export function validateTemplateCatalog(
  templates: readonly EmailTemplate[],
  knownCategoryIds?: ReadonlySet<string>,
): CatalogValidationResult {
  const issues: CatalogValidationIssue[] = [];
  const seenIds = new Map<string, number>();

  for (const template of templates) {
    const id = template.id;
    seenIds.set(id, (seenIds.get(id) ?? 0) + 1);

    // Duplicate variable keys within a single template.
    const seenKeys = new Set<string>();
    for (const variable of template.variables) {
      if (!VARIABLE_KEY_PATTERN.test(variable.key)) {
        issues.push({
          templateId: id,
          code: "DUPLICATE_VARIABLE_KEY",
          message: `Variable key '${variable.key}' is not a valid identifier.`,
        });
        continue;
      }
      if (seenKeys.has(variable.key)) {
        issues.push({
          templateId: id,
          code: "DUPLICATE_VARIABLE_KEY",
          message: `Duplicate variable key '${variable.key}' in template '${id}'.`,
        });
      }
      seenKeys.add(variable.key);
    }

    // Referential integrity for categoryId.
    if (knownCategoryIds && template.categoryId !== null) {
      if (!knownCategoryIds.has(template.categoryId)) {
        issues.push({
          templateId: id,
          code: "UNKNOWN_CATEGORY",
          message: `Template '${id}' references unknown category '${template.categoryId}'.`,
        });
      }
    }
  }

  // Duplicate template IDs across the catalog.
  for (const [id, count] of Array.from(seenIds.entries())) {
    if (count > 1) {
      issues.push({
        templateId: id,
        code: "DUPLICATE_TEMPLATE_ID",
        message: `Template id '${id}' is duplicated ${count} times in the catalog.`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
