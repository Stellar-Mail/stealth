/**
 * Safe Mail Rendering & Sanitization Parser.
 *
 * Ensures attacker-controlled HTML, inline scripts, iframes, and event handlers
 * in inbound decrypted bodies are neutralized and transformed into safe structured
 * reader blocks without dangerous DOM execution or innerHTML vulnerabilities.
 */

export type BodyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "fields"; fields: { label: string; value: string }[] }
  | { kind: "list"; items: string[] };

export interface IsolatedRemoteResources {
  blockedUrls: string[];
  blockedCount: number;
}

export interface SafeMailContent {
  rawCleanText: string;
  hasHtmlTags: boolean;
  blocks: BodyBlock[];
  sanitizedHtml?: string;
  remoteResources: IsolatedRemoteResources;
}

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
  /on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
  /javascript\s*:/gi,
  /data\s*:\s*text\/html/gi,
];

/**
 * Sanitize raw string input by stripping dangerous tags and execution handlers.
 */
export function sanitizeRawContent(input: string): string {
  if (typeof input !== "string") return "";

  let sanitized = input;
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  return sanitized;
}

const EMPTY_REMOTE_RESOURCES: IsolatedRemoteResources = {
  blockedUrls: [],
  blockedCount: 0,
};

const REMOTE_MEDIA_TAG =
  /<(img|video|audio|source|track|link|iframe|embed|object|picture)\b[^>]*>/gi;
const REMOTE_URL = /(?:https?:)?\/\/[^\s"'<>\\]+/gi;

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls.filter(Boolean))];
}

/**
 * Strip remote resource references so opening mail cannot trigger tracking
 * pixels, remote images, or outbound fetches. Local/relative refs are also
 * dropped because the reader never loads untrusted URLs.
 */
export function isolateRemoteResources(input: string): {
  sanitized: string;
  isolation: IsolatedRemoteResources;
} {
  if (typeof input !== "string" || !input) {
    return { sanitized: "", isolation: EMPTY_REMOTE_RESOURCES };
  }

  const blockedUrls: string[] = [];
  let sanitized = sanitizeRawContent(input);

  sanitized = sanitized.replace(REMOTE_MEDIA_TAG, (tag) => {
    const matches = tag.match(REMOTE_URL);
    if (matches) blockedUrls.push(...matches);
    else if (/\bsrc\s*=/i.test(tag) || /\bhref\s*=/i.test(tag) || /\bsrcset\s*=/i.test(tag)) {
      blockedUrls.push("(blocked local resource)");
    }
    return "";
  });

  sanitized = sanitized.replace(/url\((['"]?)((?:https?:)?\/\/[^)]+)\1\)/gi, (_all, _q, url) => {
    blockedUrls.push(String(url));
    return "";
  });

  sanitized = sanitized.replace(
    /\b(?:src|href|poster|srcset|action)\s*=\s*(["']?)((?:https?:)?\/\/[^"'>\s]+)\1/gi,
    (_all, _q, url) => {
      blockedUrls.push(String(url));
      return "";
    },
  );

  const isolation = {
    blockedUrls: uniqueUrls(blockedUrls),
    blockedCount: 0,
  };
  isolation.blockedCount = isolation.blockedUrls.length;

  return { sanitized, isolation };
}

/**
 * Strip all HTML markup tags to convert HTML content into safe plain text.
 */
export function stripHtmlTags(html: string): string {
  const sanitized = sanitizeRawContent(html);
  return sanitized
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|div|section|article)>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parse input body (plain text or sanitized HTML) into structured, safe reader blocks.
 */
export function parseSafeContent(body: string): SafeMailContent {
  const isolated = isolateRemoteResources(typeof body === "string" ? body : "");
  const working = isolated.sanitized;
  const hasHtml = /<[a-z][\s\S]*>/i.test(working);
  const cleanText = hasHtml ? stripHtmlTags(working) : sanitizeRawContent(working);

  const blocks: BodyBlock[] = [];
  const lines = cleanText.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^-\s+/, ""));
        index += 1;
      }
      blocks.push({ kind: "list", items });
      continue;
    }

    if (/^[A-Za-z][A-Za-z0-9 -]{1,32}:\s+\S/.test(line)) {
      const fields: { label: string; value: string }[] = [];
      while (
        index < lines.length &&
        /^[A-Za-z][A-Za-z0-9 -]{1,32}:\s+\S/.test(lines[index].trim())
      ) {
        const [label, ...val] = lines[index].trim().split(":");
        fields.push({ label: label.trim(), value: val.join(":").trim() });
        index += 1;
      }
      blocks.push({ kind: "fields", fields });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current || /^-\s+/.test(current) || /^[A-Za-z][A-Za-z0-9 -]{1,32}:\s+\S/.test(current)) {
        break;
      }
      paragraph.push(current);
      index += 1;
    }
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    }
  }

  return {
    rawCleanText: cleanText,
    hasHtmlTags: hasHtml,
    blocks,
    sanitizedHtml: hasHtml ? sanitizeRawContent(working) : undefined,
    remoteResources: isolated.isolation,
  };
}
