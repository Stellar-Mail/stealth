// ---------------------------------------------------------------------------
// BETA-024 (Issue #1931) — wrangler config guard.
//
// Pure, dependency-free helpers that enforce the persistence-bindings policy:
//   1. The committed `wrangler.jsonc` must never contain real Cloudflare
//      resource IDs or secret values — only `{VAR_NAME}` placeholder tokens.
//   2. `preview` and `production` environments must resolve to distinct KV
//      namespaces, so the two environments can never share storage by accident.
//   3. Both named environments must declare their Durable Object binding and
//      `secrets.required` list.
//   4. After the generator injects real values, no `{VAR_NAME}` tokens may
//      remain, and the resolved IDs must still be distinct per environment.
//
// Used by `scripts/generate-wrangler-config.ts` at generate/check time and by
// the unit tests (tests/unit/config/wrangler-config.test.ts).
// ---------------------------------------------------------------------------

export interface GuardResult {
  ok: boolean;
  errors: string[];
}

/** Real Cloudflare resource IDs are lowercase 32-char hex strings. */
const REAL_ID_PATTERN = /^[0-9a-f]{32}$/;

/** Placeholder tokens look like `{UPPER_SNAKE_VAR_NAME}`. */
export const PLACEHOLDER_PATTERN = /^\{[A-Z][A-Z0-9_]{2,}\}$/;

export function isPlaceholderToken(value: unknown): value is string {
  return typeof value === "string" && PLACEHOLDER_PATTERN.test(value.trim());
}

export function isRealResourceId(value: unknown): boolean {
  return typeof value === "string" && REAL_ID_PATTERN.test(value.trim().toLowerCase());
}

/**
 * Strips line and block comments plus trailing commas so JSONC parses as
 * JSON. Respects quoted strings so comment markers inside values are left
 * intact, and a comma outside a string is dropped when it is the last element
 * of an object/array (JSONC trailing-comma style).
 */
export function stripJsoncComments(text: string): string {
  const out: string[] = [];
  let i = 0;
  let inString = false;
  let quote = "";
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out.push(ch);
      if (ch === "\\") {
        out.push(next ?? "");
        i += 2;
        continue;
      }
      if (ch === quote) inString = false;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out.push(ch);
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (ch === ",") {
      // Drop trailing commas: if only whitespace separates this comma from a
      // closing brace/bracket, JSON would reject it.
      let j = i + 1;
      while (j < text.length && /[\s]/.test(text[j])) j += 1;
      if (text[j] === "}" || text[j] === "]") {
        i += 1;
        continue;
      }
    }
    out.push(ch);
    i += 1;
  }
  return out.join("");
}

export function parseJsonc<T>(text: string): T {
  return JSON.parse(stripJsoncComments(text)) as T;
}

/** Collects every `{VAR_NAME}` placeholder token in a config object (with paths). */
export function findPlaceholders(
  value: unknown,
  path = "$",
  found: Array<{ token: string; path: string }> = [],
): Array<{ token: string; path: string }> {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findPlaceholders(item, `${path}[${index}]`, found));
  } else if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      findPlaceholders(child, `${path}.${key}`, found);
    }
  } else if (isPlaceholderToken(value)) {
    found.push({ token: value, path });
  }
  return found;
}

/** Recursively replaces placeholder tokens using the supplied env mapping. */
export function resolvePlaceholders(
  value: unknown,
  env: Record<string, string | undefined>,
  missing: string[] = [],
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolvePlaceholders(item, env, missing));
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = resolvePlaceholders(child, env, missing);
    }
    return result;
  }
  if (isPlaceholderToken(value)) {
    const name = value.slice(1, -1);
    const replacement = env[name];
    if (replacement === undefined || replacement === "") {
      missing.push(name);
      return value;
    }
    return replacement;
  }
  return value;
}

function kvIdsForEnv(config: Record<string, any>, envName: string): string[] {
  const envConfig = config.env?.[envName];
  const namespaces = envConfig?.kv_namespaces ?? [];
  return namespaces
    .map((ns: { id?: string }) => ns.id)
    .filter((id: unknown): id is string => typeof id === "string");
}

/**
 * Validates the committed `wrangler.jsonc` source (placeholders must be used,
 * real IDs must not be present, environments must be isolated and complete).
 */
export function validateCommittedConfig(text: string): GuardResult {
  const errors: string[] = [];
  let config: Record<string, any>;
  try {
    config = parseJsonc<Record<string, any>>(text);
  } catch (error) {
    return { ok: false, errors: [`wrangler.jsonc is not valid JSONC: ${String(error)}`] };
  }

  // 1. No real resource IDs anywhere in the committed config.
  const realIds: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`));
    else if (typeof value === "object" && value !== null) {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walk(child, `${path}.${key}`);
      }
    } else if (isRealResourceId(value)) {
      realIds.push(path);
    }
  };
  walk(config, "$");
  if (realIds.length > 0) {
    errors.push(
      `Real Cloudflare resource IDs must never be committed; found at: ${realIds.join(", ")}`,
    );
  }

  // 2. Every KV namespace id must be a placeholder token.
  const allNs = [
    ...(config.kv_namespaces ?? []),
    ...(config.env?.preview?.kv_namespaces ?? []),
    ...(config.env?.production?.kv_namespaces ?? []),
  ];
  for (const ns of allNs) {
    if (!isPlaceholderToken(ns?.id)) {
      errors.push(
        `KV namespace binding "${ns?.binding}" id must be a {VAR_NAME} placeholder (found "${ns?.id}")`,
      );
    }
  }

  // 3. Placeholder tokens must actually be present so generation is possible.
  const placeholders = findPlaceholders(config);
  if (placeholders.length === 0) {
    errors.push("No {VAR_NAME} placeholder tokens found; generator has nothing to substitute");
  }

  // 4. Named environments must exist and be complete.
  for (const envName of ["preview", "production"]) {
    const envConfig = config.env?.[envName];
    if (!envConfig) {
      errors.push(`Missing "env.${envName}" section`);
      continue;
    }
    if (!envConfig.durable_objects?.bindings?.length) {
      errors.push(`env.${envName} must declare durable_objects.bindings`);
    }
    if (!envConfig.secrets?.required?.length) {
      errors.push(`env.${envName} must declare secrets.required`);
    }
    const kvIds = kvIdsForEnv(config, envName);
    if (kvIds.length === 0) {
      errors.push(`env.${envName} must declare at least one kv_namespaces id`);
    }
  }

  // 5. Preview and production must use distinct KV namespace placeholders.
  const previewIds = kvIdsForEnv(config, "preview");
  const productionIds = kvIdsForEnv(config, "production");
  const shared = previewIds.filter((id) => productionIds.includes(id));
  if (shared.length > 0) {
    errors.push(
      `Preview and production share KV namespace id(s) ${shared.join(", ")}; environments must not share storage`,
    );
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Validates the generated (resolved) config: no placeholder tokens may remain,
 * and the resolved preview/production KV ids must still be distinct.
 */
export function validateResolvedConfig(config: Record<string, any>): GuardResult {
  const errors: string[] = [];
  const remaining = findPlaceholders(config);
  if (remaining.length > 0) {
    errors.push(
      `Placeholder tokens remain after generation (missing env vars?): ${remaining
        .map((r) => r.token)
        .join(", ")}`,
    );
  }
  const previewIds = kvIdsForEnv(config, "preview");
  const productionIds = kvIdsForEnv(config, "production");
  const shared = previewIds.filter((id) => productionIds.includes(id));
  if (shared.length > 0) {
    errors.push(
      `Preview and production resolve to the same KV namespace id ${shared.join(", ")}; environments must not share storage`,
    );
  }
  return { ok: errors.length === 0, errors };
}
