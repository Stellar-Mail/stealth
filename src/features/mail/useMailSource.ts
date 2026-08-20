// ---------------------------------------------------------------------------
// BETA-053 / BETA-054 — live mailbox source + workspace overlay.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Email } from "@/components/mail/data";
import { errorLabel, normalizeApiClientError, type MailboxFlagsPatch } from "@/lib/api";
import { sessionActor, useSession } from "./useSession";
import { useTombstoneMessage } from "./useMailbox";
import { useMailboxSync } from "./useMailboxSync";
import { resolveMailSourceView, type MailSourceView } from "./source-view";
import {
  applyEmailPatch,
  EMPTY_MAIL_WORKSPACE,
  insertWorkspaceEmail,
  mergeMailWorkspace,
  revertEmailPatch,
  type MailWorkspaceOverlay,
} from "./workspace";
import {
  applyOverlayToCounts,
  claimMailboxMutation,
  emailPatchFromFlags,
  mailboxMutationKey,
  mergeLiveFolderCounts,
} from "./live-mailbox";
import { buildFolderCounts } from "./navigation";

export interface UseMailSourceOptions {
  isDemoMode: boolean;
}

export type MailMutationResult = { ok: true } | { ok: false; reason: string };
export type TrashResult = MailMutationResult;

export function useMailSource({ isDemoMode }: UseMailSourceOptions) {
  const session = useSession({ enabled: !isDemoMode });
  const actor = sessionActor(session.data);
  const mailbox = useMailboxSync({
    actor: actor ?? "anonymous",
    enabled: Boolean(actor) && !isDemoMode,
  });
  const tombstone = useTombstoneMessage(actor ?? "anonymous");

  const [demoEmails, setDemoEmails] = useState<Email[]>([]);
  const [demoReady, setDemoReady] = useState(!isDemoMode);
  const [overlay, setOverlay] = useState<MailWorkspaceOverlay>(EMPTY_MAIL_WORKSPACE);
  const pendingMutations = useRef(new Set<string>());

  useEffect(() => {
    if (!import.meta.env.DEV || !isDemoMode) return;
    let cancelled = false;
    void import("@/features/mail/demo/demo-data").then(({ getDemoEmails }) => {
      if (cancelled) return;
      setDemoEmails(getDemoEmails());
      setDemoReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isDemoMode]);

  const serverEmails = isDemoMode ? demoEmails : mailbox.emails;
  const emails = useMemo(() => mergeMailWorkspace(serverEmails, overlay), [overlay, serverEmails]);
  const folderCounts = useMemo(() => {
    const local = buildFolderCounts(emails);
    if (isDemoMode) return local;
    const live = mailbox.counts
      ? applyOverlayToCounts(mailbox.counts, overlay, serverEmails)
      : null;
    return mergeLiveFolderCounts(local, live);
  }, [emails, isDemoMode, mailbox.counts, overlay, serverEmails]);

  const updateEmail = useCallback((id: string, patch: Partial<Email>) => {
    setOverlay((current) => applyEmailPatch(current, id, patch));
  }, []);

  const insertEmail = useCallback((email: Email) => {
    setOverlay((current) => insertWorkspaceEmail(current, email));
  }, []);

  const mutateMailbox = useCallback(
    async (email: Email, patch: MailboxFlagsPatch): Promise<MailMutationResult> => {
      const key = mailboxMutationKey(email.id, patch);
      if (!claimMailboxMutation(pendingMutations.current, key)) {
        return { ok: true };
      }

      const displayPatch = emailPatchFromFlags(patch);
      setOverlay((current) => applyEmailPatch(current, email.id, displayPatch));

      if (isDemoMode || !actor) {
        pendingMutations.current.delete(key);
        return { ok: true };
      }

      try {
        if (patch.folder === "trash") {
          await tombstone.mutateAsync(email.id);
        } else {
          await mailbox.patchFlags({ messageId: email.id, patch });
        }
        pendingMutations.current.delete(key);
        return { ok: true };
      } catch (error) {
        pendingMutations.current.delete(key);
        setOverlay((current) =>
          revertEmailPatch(current, email.id, displayPatchRestore(email, patch)),
        );
        return { ok: false, reason: errorLabel(normalizeApiClientError(error)) };
      }
    },
    [actor, isDemoMode, mailbox, tombstone],
  );

  const trashEmail = useCallback(
    async (email: Email): Promise<TrashResult> => {
      if (email.folder === "trash") return { ok: true };
      return mutateMailbox(email, { folder: "trash" });
    },
    [mutateMailbox],
  );

  const retry = useCallback(async () => {
    if (session.isError) await session.refetch();
    if (mailbox.isError) await mailbox.refetch();
  }, [mailbox, session]);

  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const sourceView: MailSourceView = resolveMailSourceView({
    isDemoMode,
    demoReady,
    sessionLoading: session.isLoading,
    sessionError: session.error,
    mailboxLoading: mailbox.isLoading,
    mailboxFetching: mailbox.isFetching,
    mailboxError: mailbox.error,
    mailboxFetched: mailbox.isFetched,
    emailCount: emails.length,
    online,
  });

  return {
    actor,
    emails,
    folderCounts,
    updateEmail,
    insertEmail,
    trashEmail,
    mutateMailbox,
    retry,
    sourceView,
    isDemoMode,
    hasMore: isDemoMode ? false : mailbox.hasMore,
    isLoadingMore: isDemoMode ? false : mailbox.isFetchingNextPage,
    loadMore: mailbox.fetchNextPage,
  };
}

function displayPatchRestore(email: Email, patch: MailboxFlagsPatch): Partial<Email> {
  const restore: Partial<Email> = {};
  if (patch.unread !== undefined) restore.unread = email.unread;
  if (patch.starred !== undefined) restore.starred = email.starred;
  if (patch.folder) restore.folder = email.folder;
  return restore;
}
