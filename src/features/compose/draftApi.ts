import type { Draft, DraftCreateInput, DraftUpdateInput } from "@/server/api/domain";

// ---------------------------------------------------------------------------
// Issue #1965 (BETA-058) — Live drafts client API
//
// Typed client calling /api/v1/drafts endpoints with optimistic concurrency
// revision control and explicit conflict error modeling.
// ---------------------------------------------------------------------------

export class DraftConflictError extends Error {
  readonly code = "conflict" as const;
  readonly currentDraft: Draft;

  constructor(message: string, currentDraft: Draft) {
    super(message);
    this.name = "DraftConflictError";
    this.currentDraft = currentDraft;
  }
}

export class DraftApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "DraftApiError";
    this.status = status;
    this.code = code;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 409) {
    const errorBody = await res.json().catch(() => ({}));
    const current = errorBody?.error?.details?.current;
    throw new DraftConflictError(errorBody?.error?.message ?? "Draft revision conflict", current);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody?.error?.message ?? `Request failed with status ${res.status}`;
    const code = errorBody?.error?.code ?? "unknown_error";
    throw new DraftApiError(res.status, code, message);
  }

  const body = await res.json();
  return body.data as T;
}

export async function fetchDraftList(
  cursor?: string,
  limit: number = 25,
): Promise<{ items: Draft[]; nextContinuationKey: string | null }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", limit.toString());

  const url = `/api/v1/drafts${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  return handleResponse<{ items: Draft[]; nextContinuationKey: string | null }>(res);
}

export async function fetchDraft(draftId: string): Promise<Draft> {
  const res = await fetch(`/api/v1/drafts/${encodeURIComponent(draftId)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  return handleResponse<Draft>(res);
}

export async function createDraft(input: DraftCreateInput): Promise<Draft> {
  const res = await fetch("/api/v1/drafts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  return handleResponse<Draft>(res);
}

export async function updateDraft(
  draftId: string,
  input: DraftUpdateInput,
  expectedVersion: number,
): Promise<Draft> {
  const res = await fetch(`/api/v1/drafts/${encodeURIComponent(draftId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      ...input,
      expectedVersion,
    }),
  });

  return handleResponse<Draft>(res);
}

export async function deleteDraft(draftId: string): Promise<void> {
  const res = await fetch(`/api/v1/drafts/${encodeURIComponent(draftId)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (res.status === 404) {
    // Already gone
    return;
  }

  await handleResponse<{ deleted: boolean }>(res);
}
