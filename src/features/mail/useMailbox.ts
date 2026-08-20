// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — typed mailbox queue hook.
//
// Consumes the typed mailbox client and maps the live queue to the display
// `Email` model used by the app shell. Full header/body sync is owned by
// BETA-034 (Issue #1941); this hook is the typed read path the shell renders
// from today.
// ---------------------------------------------------------------------------

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

import { sharedTypedApi as api, queryKeys, cacheInvalidations } from "@/lib/api";
import type { MailboxDescriptor, MailboxQueueResponse } from "@/lib/api";
import type { Email } from "@/components/mail/data";
import { descriptorFolder, threadIdFromDescriptor } from "./live-mailbox";

export interface UseMailboxOptions {
  /** Authenticated actor (Stellar G-address) owning the mailbox. */
  actor: string;
  enabled?: boolean;
}

/** Maps a server mailbox descriptor into the shell's display `Email` shape. */
export function mailboxDescriptorToEmail(descriptor: MailboxDescriptor): Email {
  const headers = descriptor.protectedHeaders ?? {};
  const subject =
    typeof headers.subject === "string" && headers.subject.trim()
      ? headers.subject
      : "Encrypted message";
  const from =
    typeof headers.from === "string" && headers.from.trim() ? headers.from : descriptor.senderId;
  const created = new Date(descriptor.createdAt);
  const time = Number.isNaN(created.getTime())
    ? descriptor.createdAt
    : created.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  const folder = descriptorFolder(descriptor);
  const unread =
    typeof descriptor.unread === "boolean" ? descriptor.unread : descriptor.status === "pending";

  return {
    id: descriptor.messageId,
    from,
    email: descriptor.senderId,
    subject,
    preview: descriptor.isTombstone ? "This message was deleted." : "Encrypted payload",
    body: "",
    time,
    unread,
    starred: Boolean(descriptor.starred),
    folder,
    labels: descriptor.isTombstone ? ["Deleted"] : [],
    attachments: [],
    avatarColor: "#5b6470",
    verifiedSender: false,
    threadId: threadIdFromDescriptor(descriptor),
  };
}

/** Maps a typed queue response page into the shell's display `Email` list. */
export function mailboxQueueToEmails(response: MailboxQueueResponse): Email[] {
  return response.items.map(mailboxDescriptorToEmail);
}

/**
 * Reads the authenticated recipient's mailbox queue through the typed client.
 * The live path renders server descriptors; the demo/storybook path uses a
 * mock adapter instead (see `src/features/mail/demo-data.ts`).
 */
export function useMailbox({ actor, enabled = true }: UseMailboxOptions) {
  return useQuery({
    queryKey: queryKeys.mailbox.queue(actor),
    queryFn: ({ signal }) => api.mailbox.listQueue({}, signal),
    enabled,
    select: mailboxQueueToEmails,
  });
}

/** Raw live descriptors for services such as notification delivery that must retain event timestamps. */
export function useMailboxDescriptors({ actor, enabled = true }: UseMailboxOptions) {
  return useQuery({
    queryKey: queryKeys.mailbox.queue(actor),
    queryFn: ({ signal }) => api.mailbox.listQueue({}, signal),
    enabled,
  });
}

/** Tombstones a message in the live mailbox and invalidates the queue cache. */
export function useTombstoneMessage(actor: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => api.mailbox.tombstone(messageId),
    onSuccess: async () => {
      for (const key of cacheInvalidations.tombstoneMessage(actor)) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
