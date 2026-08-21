import { useCallback, useEffect, useRef, useState } from "react";
import type { Draft, DraftAttachmentDescriptor } from "@/server/api/domain";
import { createDraft, deleteDraft, DraftConflictError, updateDraft } from "./draftApi";

export type DraftSaveStatus = "idle" | "saving" | "saved" | "conflict" | "error";

export interface UseDraftAutosaveOptions {
  initialDraftId?: string | null;
  initialVersion?: number;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: DraftAttachmentDescriptor[];
  debounceMs?: number;
  enabled?: boolean;
  onApplyServerDraft?: (draft: Draft) => void;
}

export interface UseDraftAutosaveResult {
  draftId: string | null;
  version: number;
  saveStatus: DraftSaveStatus;
  lastSavedAt: Date | null;
  conflictDraft: Draft | null;
  isDirty: boolean;
  errorMessage: string | null;
  flushDraftSave: () => Promise<Draft | null>;
  cancelAutosave: () => void;
  discardDraft: () => Promise<void>;
  resolveConflictOverwrite: () => Promise<void>;
  resolveConflictLoadServer: () => void;
  resolveConflictForkNew: () => Promise<void>;
}

function parseToArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value
    .split(/[,;\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function isContentEmpty(
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  body: string,
  attachments: DraftAttachmentDescriptor[],
): boolean {
  return (
    to.length === 0 &&
    cc.length === 0 &&
    bcc.length === 0 &&
    subject.trim().length === 0 &&
    body.trim().length === 0 &&
    attachments.length === 0
  );
}

export function useDraftAutosave({
  initialDraftId = null,
  initialVersion = 1,
  to,
  cc = [],
  bcc = [],
  subject,
  body,
  attachments = [],
  debounceMs = 1200,
  enabled = true,
  onApplyServerDraft,
}: UseDraftAutosaveOptions): UseDraftAutosaveResult {
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [version, setVersion] = useState<number>(initialVersion);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [conflictDraft, setConflictDraft] = useState<Draft | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);

  // Keep references to latest field values for the async autosave function
  const latestValues = useRef({
    to,
    cc,
    bcc,
    subject,
    body,
    attachments,
  });

  latestValues.current = {
    to,
    cc,
    bcc,
    subject,
    body,
    attachments,
  };

  const lastSavedSnapshot = useRef<string>("");

  const computeSnapshot = useCallback(
    (
      toVal: string | string[],
      ccVal: string[],
      bccVal: string[],
      subjVal: string,
      bodyVal: string,
      attVal: DraftAttachmentDescriptor[],
    ) => {
      const normalizedTo = parseToArray(toVal).sort().join(",");
      const normalizedCc = ccVal.slice().sort().join(",");
      const normalizedBcc = bccVal.slice().sort().join(",");
      const atts = attVal
        .map((a) => `${a.filename}:${a.sizeBytes}:${a.contentHash ?? ""}`)
        .sort()
        .join(";");
      return `${normalizedTo}|${normalizedCc}|${normalizedBcc}|${subjVal}|${bodyVal}|${atts}`;
    },
    [],
  );

  const cancelAutosave = useCallback(() => {
    isCancelledRef.current = true;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const performSave = useCallback(async (): Promise<Draft | null> => {
    if (isSavingRef.current || isCancelledRef.current) {
      return null;
    }

    const {
      to: currentTo,
      cc: currentCc,
      bcc: currentBcc,
      subject: currentSubject,
      body: currentBody,
      attachments: currentAttachments,
    } = latestValues.current;

    const toArr = parseToArray(currentTo);
    const ccArr = currentCc ?? [];
    const bccArr = currentBcc ?? [];
    const currentSnap = computeSnapshot(
      currentTo,
      ccArr,
      bccArr,
      currentSubject,
      currentBody,
      currentAttachments,
    );

    // If draft is completely empty and doesn't exist on server yet, do not create an empty row
    if (
      !draftId &&
      isContentEmpty(toArr, ccArr, bccArr, currentSubject, currentBody, currentAttachments)
    ) {
      setIsDirty(false);
      setSaveStatus("idle");
      return null;
    }

    // If already saved this snapshot and not in error, skip
    if (currentSnap === lastSavedSnapshot.current && saveStatus === "saved") {
      setIsDirty(false);
      return null;
    }

    isSavingRef.current = true;
    setSaveStatus("saving");
    setErrorMessage(null);

    try {
      let savedDraft: Draft;
      if (!draftId) {
        // Create new draft
        savedDraft = await createDraft({
          to: toArr,
          cc: ccArr,
          bcc: bccArr,
          subject: currentSubject,
          body: currentBody,
          attachments: currentAttachments,
        });
        setDraftId(savedDraft.draftId);
        setVersion(savedDraft.version);
      } else {
        // Update existing draft
        savedDraft = await updateDraft(
          draftId,
          {
            to: toArr,
            cc: ccArr,
            bcc: bccArr,
            subject: currentSubject,
            body: currentBody,
            attachments: currentAttachments,
            expectedVersion: version,
          },
          version,
        );
        setVersion(savedDraft.version);
      }

      lastSavedSnapshot.current = currentSnap;
      setLastSavedAt(new Date(savedDraft.updatedAt));
      setSaveStatus("saved");
      setIsDirty(false);
      setConflictDraft(null);
      return savedDraft;
    } catch (err: unknown) {
      if (err instanceof DraftConflictError) {
        setSaveStatus("conflict");
        setConflictDraft(err.currentDraft);
        setErrorMessage(err.message);
      } else {
        setSaveStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to save draft. Edits preserved locally.",
        );
      }
      return null;
    } finally {
      isSavingRef.current = false;
    }
  }, [computeSnapshot, draftId, saveStatus, version]);

  const flushDraftSave = useCallback(async (): Promise<Draft | null> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    isCancelledRef.current = false;
    return performSave();
  }, [performSave]);

  const discardDraft = useCallback(async (): Promise<void> => {
    cancelAutosave();
    if (draftId) {
      try {
        await deleteDraft(draftId);
      } catch {
        // Ignore delete errors
      }
    }
    setDraftId(null);
    setVersion(1);
    setIsDirty(false);
    setSaveStatus("idle");
    setConflictDraft(null);
    lastSavedSnapshot.current = "";
  }, [cancelAutosave, draftId]);

  const resolveConflictOverwrite = useCallback(async (): Promise<void> => {
    if (!conflictDraft || !draftId) return;
    const serverVer = conflictDraft.version;
    setVersion(serverVer);
    setConflictDraft(null);
    setSaveStatus("saving");

    const {
      to: currentTo,
      cc: currentCc,
      bcc: currentBcc,
      subject: currentSubject,
      body: currentBody,
      attachments: currentAttachments,
    } = latestValues.current;

    try {
      const saved = await updateDraft(
        draftId,
        {
          to: parseToArray(currentTo),
          cc: currentCc ?? [],
          bcc: currentBcc ?? [],
          subject: currentSubject,
          body: currentBody,
          attachments: currentAttachments,
          expectedVersion: serverVer,
        },
        serverVer,
      );
      setVersion(saved.version);
      setLastSavedAt(new Date(saved.updatedAt));
      setSaveStatus("saved");
      setIsDirty(false);
    } catch (err) {
      if (err instanceof DraftConflictError) {
        setSaveStatus("conflict");
        setConflictDraft(err.currentDraft);
      } else {
        setSaveStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to overwrite draft");
      }
    }
  }, [conflictDraft, draftId]);

  const resolveConflictLoadServer = useCallback(() => {
    if (!conflictDraft) return;
    onApplyServerDraft?.(conflictDraft);
    setVersion(conflictDraft.version);
    setLastSavedAt(new Date(conflictDraft.updatedAt));
    setConflictDraft(null);
    setSaveStatus("saved");
    setIsDirty(false);

    lastSavedSnapshot.current = computeSnapshot(
      conflictDraft.to,
      conflictDraft.cc,
      conflictDraft.bcc,
      conflictDraft.subject,
      conflictDraft.body,
      conflictDraft.attachments,
    );
  }, [computeSnapshot, conflictDraft, onApplyServerDraft]);

  const resolveConflictForkNew = useCallback(async (): Promise<void> => {
    setDraftId(null);
    setVersion(1);
    setConflictDraft(null);
    setSaveStatus("idle");
    setIsDirty(true);
    lastSavedSnapshot.current = "";

    // Trigger fresh save as a new draft
    setTimeout(() => {
      performSave();
    }, 50);
  }, [performSave]);

  // Track field changes and trigger debounced autosave
  useEffect(() => {
    if (!enabled) return;

    const currentSnap = computeSnapshot(to, cc, bcc, subject, body, attachments);

    // Initial snapshot establishment
    if (!lastSavedSnapshot.current && !draftId) {
      lastSavedSnapshot.current = currentSnap;
      return;
    }

    if (currentSnap !== lastSavedSnapshot.current) {
      setIsDirty(true);
      isCancelledRef.current = false;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        performSave();
      }, debounceMs);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    attachments,
    bcc,
    body,
    cc,
    computeSnapshot,
    debounceMs,
    draftId,
    enabled,
    performSave,
    subject,
    to,
  ]);

  return {
    draftId,
    version,
    saveStatus,
    lastSavedAt,
    conflictDraft,
    isDirty,
    errorMessage,
    flushDraftSave,
    cancelAutosave,
    discardDraft,
    resolveConflictOverwrite,
    resolveConflictLoadServer,
    resolveConflictForkNew,
  };
}
