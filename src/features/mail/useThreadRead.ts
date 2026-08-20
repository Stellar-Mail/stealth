// ---------------------------------------------------------------------------
// BETA-055 (Issue #1962) — fetch selected envelopes and build a live thread.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { Email } from "@/components/mail/data";
import { queryKeys, sharedTypedApi as api } from "@/lib/api";
import type { MailboxSealedMessage } from "@/lib/api";
import { applyThreadMessageToEmail, buildMailThread, siblingMessageIds } from "./live-thread";
import { getMailboxKeyProvider } from "./mailbox-keys";
import {
  classifyMailSourceError,
  type ClassifiedMailSourceError,
  type MailSourceView,
} from "./source-view";

export type ThreadReadView =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; stale: boolean }
  | { kind: "error"; failure: ClassifiedMailSourceError };

export interface UseThreadReadOptions {
  actor: string | null;
  selectedId: string | null;
  emails: Email[];
  enabled?: boolean;
  isDemoMode?: boolean;
}

export function useThreadRead({
  actor,
  selectedId,
  emails,
  enabled = true,
  isDemoMode = false,
}: UseThreadReadOptions) {
  const messageIds = useMemo(
    () => (selectedId ? siblingMessageIds(emails, selectedId) : []),
    [emails, selectedId],
  );
  const live = Boolean(enabled && actor && selectedId && !isDemoMode);
  const threadKey = queryKeys.mailbox.thread(actor ?? "anonymous");

  const query = useQuery({
    queryKey: [...threadKey, selectedId, messageIds],
    enabled: live,
    queryFn: async ({ signal }) => {
      if (!selectedId || !actor) throw new Error("missing selection");
      const selected = await api.mailbox.getMessage(selectedId, signal);
      const extras = messageIds.filter((id) => id !== selectedId);
      const settled = await Promise.allSettled(
        extras.map((id) => api.mailbox.getMessage(id, signal)),
      );
      const sealed: MailboxSealedMessage[] = [
        selected,
        ...settled
          .filter((item): item is PromiseFulfilledResult<MailboxSealedMessage> => {
            return item.status === "fulfilled";
          })
          .map((item) => item.value),
      ];
      return buildMailThread(sealed, getMailboxKeyProvider(), selectedId, actor);
    },
  });

  const thread = query.data ?? null;
  const selectedEmail = emails.find((email) => email.id === selectedId) ?? null;
  const selectedMessage =
    thread?.messages.find((message) => message.messageId === selectedId) ??
    thread?.messages[0] ??
    null;
  const readerEmail =
    selectedEmail && selectedMessage
      ? applyThreadMessageToEmail(selectedEmail, selectedMessage)
      : selectedEmail;
  const threadFetching = query.isFetching;
  const threadPending = query.isPending;
  const threadError = query.isError ? query.error : null;

  const view: ThreadReadView = !live
    ? { kind: "idle" }
    : threadError
      ? {
          kind: "error",
          failure: classifyMailSourceError(
            threadError,
            typeof navigator === "undefined" ? true : navigator.onLine,
          ),
        }
      : threadPending || (!thread && threadFetching)
        ? { kind: "loading" }
        : { kind: "ready", stale: threadFetching };

  const sourceView: MailSourceView | null =
    view.kind === "error"
      ? { kind: "error", failure: view.failure, hasCachedData: Boolean(thread) }
      : view.kind === "loading"
        ? { kind: "loading" }
        : null;

  return {
    thread,
    readerEmail,
    view,
    sourceView,
    retry: () => query.refetch(),
    isFetching: threadFetching,
  };
}
