// ---------------------------------------------------------------------------
// BETA-071 (Issue #1978) — persist unsent compose work across offline/errors.
// ---------------------------------------------------------------------------

export const UNSENT_DRAFT_STORAGE_KEY = "stealth.mail.unsentDraft";

export interface UnsentDraft {
  to: string;
  subject: string;
  body: string;
  postage: string;
  updatedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStorage(seed: Record<string, string> = {}): StorageLike {
  const data = { ...seed };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

export function defaultUnsentStorage(): StorageLike | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function isDraftEmpty(draft: Pick<UnsentDraft, "to" | "subject" | "body">): boolean {
  return !draft.to.trim() && !draft.subject.trim() && !draft.body.trim();
}

export function saveUnsentDraft(
  draft: Omit<UnsentDraft, "updatedAt">,
  storage: StorageLike | null = defaultUnsentStorage(),
  now = () => new Date().toISOString(),
): UnsentDraft | null {
  if (!storage) return null;
  if (isDraftEmpty(draft)) {
    storage.removeItem(UNSENT_DRAFT_STORAGE_KEY);
    return null;
  }
  const record: UnsentDraft = { ...draft, updatedAt: now() };
  try {
    storage.setItem(UNSENT_DRAFT_STORAGE_KEY, JSON.stringify(record));
    return record;
  } catch {
    return record;
  }
}

export function readUnsentDraft(
  storage: StorageLike | null = defaultUnsentStorage(),
): UnsentDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(UNSENT_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UnsentDraft>;
    if (typeof parsed.to !== "string" || typeof parsed.body !== "string") return null;
    return {
      to: parsed.to,
      subject: typeof parsed.subject === "string" ? parsed.subject : "",
      body: parsed.body,
      postage: typeof parsed.postage === "string" ? parsed.postage : "0.0001",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

export function clearUnsentDraft(storage: StorageLike | null = defaultUnsentStorage()): void {
  storage?.removeItem(UNSENT_DRAFT_STORAGE_KEY);
}

export function restoreDraftIfBlank(
  initial: { to?: string; subject?: string; body?: string },
  stored: UnsentDraft | null,
): { to: string; subject: string; body: string; postage?: string; restored: boolean } {
  const hasInitial = Boolean(initial.to?.trim() || initial.subject?.trim() || initial.body?.trim());
  if (hasInitial || !stored) {
    return {
      to: initial.to ?? "",
      subject: initial.subject ?? "",
      body: initial.body ?? "",
      restored: false,
    };
  }
  return {
    to: stored.to,
    subject: stored.subject,
    body: stored.body,
    postage: stored.postage,
    restored: true,
  };
}
