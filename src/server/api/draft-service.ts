import {
  draftCreateSchema,
  draftUpdateSchema,
  type Draft,
  type DraftContent,
  type DraftCreateInput,
  type DraftRecord,
  type DraftUpdateInput,
} from "./domain";
import { openDraftContent, sealDraftContent } from "./draft-crypto";
import { ApiError } from "./errors";
import type { ApiRepository, DraftQueryOptions, Page } from "./repository";

// ---------------------------------------------------------------------------
// Issue #1965 (BETA-058) — Live drafts service
//
// Manages draft creation, retrieval, updates with optimistic concurrency
// revision checks (expectedVersion), and deletion. Every draft is sealed
// at rest using AES-256-GCM authenticated with AAD.
// ---------------------------------------------------------------------------

export interface DraftListResult {
  items: Draft[];
  nextContinuationKey: string | null;
}

function draftIdFactory(): string {
  return `d_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeOwner(owner: string): string {
  return owner.trim().toUpperCase();
}

async function recordToDraft(owner: string, record: DraftRecord): Promise<Draft> {
  const content = await openDraftContent(owner, record.draftId, record);
  return {
    draftId: record.draftId,
    owner: record.owner,
    to: content.to,
    cc: content.cc,
    bcc: content.bcc,
    subject: content.subject,
    body: content.body,
    attachments: content.attachments,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listDrafts(
  repository: ApiRepository,
  owner: string,
  options: DraftQueryOptions = {},
): Promise<DraftListResult> {
  const normOwner = normalizeOwner(owner);
  const page: Page<DraftRecord> = await repository.listDrafts(normOwner, options);

  const items = await Promise.all(page.items.map((record) => recordToDraft(normOwner, record)));

  return {
    items,
    nextContinuationKey: page.nextContinuationKey,
  };
}

export async function getDraft(
  repository: ApiRepository,
  owner: string,
  draftId: string,
): Promise<Draft> {
  const normOwner = normalizeOwner(owner);
  const record = await repository.getDraft(normOwner, draftId);
  if (!record || normalizeOwner(record.owner) !== normOwner) {
    throw new ApiError(404, "not_found", `No draft found for ${draftId}`);
  }

  return recordToDraft(normOwner, record);
}

export async function createDraft(
  repository: ApiRepository,
  owner: string,
  input: DraftCreateInput,
): Promise<Draft> {
  const parsed = draftCreateSchema.parse(input);
  const normOwner = normalizeOwner(owner);
  const draftId = parsed.draftId?.trim() || draftIdFactory();
  const now = new Date().toISOString();

  const content: DraftContent = {
    to: parsed.to,
    cc: parsed.cc,
    bcc: parsed.bcc,
    subject: parsed.subject,
    body: parsed.body,
    attachments: parsed.attachments,
  };

  const sealed = await sealDraftContent(normOwner, draftId, content);

  const record: DraftRecord = {
    draftId,
    owner: normOwner,
    encryptedPayload: sealed.encryptedPayload,
    nonce: sealed.nonce,
    tag: sealed.tag,
    algorithm: sealed.algorithm,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await repository.createDraft(record);

  return {
    draftId,
    owner: normOwner,
    ...content,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateDraft(
  repository: ApiRepository,
  owner: string,
  draftId: string,
  input: DraftUpdateInput,
  expectedVersion: number,
): Promise<Draft> {
  const parsed = draftUpdateSchema.parse(input);
  const normOwner = normalizeOwner(owner);
  const existingRecord = await repository.getDraft(normOwner, draftId);
  if (!existingRecord || normalizeOwner(existingRecord.owner) !== normOwner) {
    throw new ApiError(404, "not_found", `No draft found for ${draftId}`);
  }

  if (existingRecord.version !== expectedVersion) {
    const currentDraft = await recordToDraft(normOwner, existingRecord);
    throw new ApiError(
      409,
      "conflict",
      `Draft revision conflict: expected version ${expectedVersion} but server is at version ${existingRecord.version}`,
      { current: currentDraft },
    );
  }

  const existingContent = await openDraftContent(normOwner, draftId, existingRecord);

  const mergedContent: DraftContent = {
    to: parsed.to ?? existingContent.to,
    cc: parsed.cc ?? existingContent.cc,
    bcc: parsed.bcc ?? existingContent.bcc,
    subject: parsed.subject !== undefined ? parsed.subject : existingContent.subject,
    body: parsed.body !== undefined ? parsed.body : existingContent.body,
    attachments: parsed.attachments ?? existingContent.attachments,
  };

  const now = new Date().toISOString();
  const sealed = await sealDraftContent(normOwner, draftId, mergedContent);

  const updatedRecord: DraftRecord = {
    draftId,
    owner: normOwner,
    encryptedPayload: sealed.encryptedPayload,
    nonce: sealed.nonce,
    tag: sealed.tag,
    algorithm: sealed.algorithm,
    version: expectedVersion + 1,
    createdAt: existingRecord.createdAt,
    updatedAt: now,
  };

  const result = await repository.updateDraft(updatedRecord, expectedVersion);
  if (!result.updated) {
    if (result.current) {
      const currentDraft = await recordToDraft(normOwner, result.current);
      throw new ApiError(
        409,
        "conflict",
        `Draft revision conflict: expected version ${expectedVersion} but server is at version ${result.current.version}`,
        { current: currentDraft },
      );
    }
    throw new ApiError(404, "not_found", `No draft found for ${draftId}`);
  }

  return {
    draftId,
    owner: normOwner,
    ...mergedContent,
    version: expectedVersion + 1,
    createdAt: existingRecord.createdAt,
    updatedAt: now,
  };
}

export async function deleteDraft(
  repository: ApiRepository,
  owner: string,
  draftId: string,
): Promise<void> {
  const normOwner = normalizeOwner(owner);
  await repository.deleteDraft(normOwner, draftId);
}
