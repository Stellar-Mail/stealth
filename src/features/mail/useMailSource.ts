// ---------------------------------------------------------------------------
// BETA-053 / BETA-054 — live mailbox source + workspace overlay.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Email } from "@/components/mail/data";
import { errorLabel, normalizeApiClientError, type MailboxFlagsPatch } from "@/lib/api";
import { sessionActor, useSession } from "./useSession";
import { useTombstoneMessage } from "./useMailbox";
import { useMailboxSync } from "./useMailboxSync";
import { useConnectivity } from "./useConnectivity";
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
import { listOutbox, patchEntry, type OutboxEntry } from "@/services/storage/outbox";

export interface UseMailSourceOptions {
  isDemoMode: boolean;
}

export type MailMutationResult = { ok: true } | { ok: false; reason: string };
export type TrashResult = MailMutationResult;

export function outboxEntryToEmail(entry: OutboxEntry): Email {
  const folder = entry.status === "delivered" ? "sent" : "outbox";
  const unread = false;

  let preview = "Outbox: Message ready for delivery";
  if (entry.status === "failed") {
    preview = `Failed: ${entry.errorMessage ?? "Relay submission failed"}`;
  } else if (entry.status === "queued") {
    preview = "Outbox: Queued for delivery";
  } else if (entry.status === "encrypting") {
    preview = "Outbox: Encrypting message...";
  } else if (entry.status === "awaiting_signature") {
    preview = "Outbox: Awaiting wallet signature...";
  } else if (entry.status === "reserving_postage") {
    preview = "Outbox: Reserving postage...";
  } else if (entry.status === "submitting") {
    preview = "Outbox: Submitting to relay...";
  }

  const labels: string[] = [];
  if (entry.status === "failed") {
    labels.push(entry.canRetry !== false ? "Retryable Failure" : "Terminal Failure");
  } else if (entry.status === "awaiting_signature") {
    labels.push("Signature Required");
  } else if (entry.status !== "delivered") {
    labels.push("Pending Outbox");
  }

  const from = "Me";
  const email = entry.sender ?? "me";

  const created = new Date(entry.createdAt);
  const time = Number.isNaN(created.getTime())
    ? entry.createdAt
    : created.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  return {
    id: entry.id,
    from,
    email,
    subject: entry.subject || "(No Subject)",
    preview,
    body: "",
    time,
    unread,
    starred: false,
    folder,
    labels,
    attachments: [],
    avatarColor: "#5b6470",
    verifiedSender: false,
    postageAmount: entry.postageAmount,
    threadId: `thread-outbox-${entry.id}`,
  };
}

export function useMailSource({ isDemoMode }: UseMailSourceOptions) {
  const session = useSession({ enabled: !isDemoMode });
  const actor = sessionActor(session.data);
  const connectivity = useConnectivity();
  const mailbox = useMailboxSync({
    actor: actor ?? "anonymous",
    enabled: Boolean(actor) && !isDemoMode,
    online: connectivity.online,
    visible: connectivity.visible,
  });
  const tombstone = useTombstoneMessage(actor ?? "anonymous");

  const [demoEmails, setDemoEmails] = useState<Email[]>([]);
  const [demoReady, setDemoReady] = useState(!isDemoMode);
  const [overlay, setOverlay] = useState<MailWorkspaceOverlay>(EMPTY_MAIL_WORKSPACE);
  const pendingMutations = useRef(new Set<string>());
  const [outboxRevision, setOutboxRevision] = useState(0);

  const refreshOutbox = useCallback(() => {
    setOutboxRevision((prev) => prev + 1);
  }, []);

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

  useEffect(() => {
    if (serverEmails.length > 0) {
      const outbox = listOutbox();
      const serverIds = new Set(serverEmails.map((email) => email.id));
      let changed = false;
      for (const entry of outbox) {
        if (entry.status !== "delivered" && serverIds.has(entry.id)) {
          patchEntry(entry.id, {
            status: "delivered",
            isCommitted: true,
            canRetry: false,
          });
          changed = true;
        }
      }
      if (changed) {
        refreshOutbox();
      }
    }
  }, [serverEmails, refreshOutbox]);

  const emails = useMemo(() => {
    const outboxEntries = listOutbox();
    const outboxEmails = outboxEntries.map(outboxEntryToEmail);
    const combined = [...serverEmails];
    const serverIds = new Set(serverEmails.map((e) => e.id));
    for (const oEmail of outboxEmails) {
      if (!serverIds.has(oEmail.id)) {
        combined.push(oEmail);
      }
    }
    return mergeMailWorkspace(combined, overlay);
  }, [overlay, serverEmails, outboxRevision]);

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
        return { ok: false, reason: "Action already in progress" };
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
    online: connectivity.online,
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
    connectivity,
    isDemoMode,
    hasMore: isDemoMode ? false : mailbox.hasMore,
    isLoadingMore: isDemoMode ? false : mailbox.isFetchingNextPage,
    loadMore: mailbox.fetchNextPage,
    refreshOutbox,
  };
}

function displayPatchRestore(email: Email, patch: MailboxFlagsPatch): Partial<Email> {
  const restore: Partial<Email> = {};
  if (patch.unread !== undefined) restore.unread = email.unread;
  if (patch.starred !== undefined) restore.starred = email.starred;
  if (patch.folder) restore.folder = email.folder;
  return restore;
}
