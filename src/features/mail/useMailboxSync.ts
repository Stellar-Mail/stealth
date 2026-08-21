// ---------------------------------------------------------------------------
// BETA-054 (Issue #1961) — cursor mailbox sync, counts, and live mutations.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  cacheInvalidations,
  queryKeys,
  sharedTypedApi as api,
  shouldPauseSync,
  shouldResumeSync,
} from "@/lib/api";
import type {
  MailboxCounts,
  MailboxDescriptor,
  MailboxFlagsPatch,
  MailboxSyncResponse,
} from "@/lib/api";
import { mailboxDescriptorToEmail } from "./useMailbox";
import {
  MAILBOX_DELTA_INTERVAL_MS,
  MAILBOX_PAGE_SIZE,
  MAILBOX_RENDER_CAP,
  MAILBOX_SYNC_CHANNEL,
  capMailboxWindow,
  mergeMailboxDescriptors,
  readSyncCursor,
  writeSyncCursor,
  type MailboxBroadcast,
} from "./live-mailbox";

export interface UseMailboxSyncOptions {
  actor: string;
  enabled?: boolean;
  online?: boolean;
  visible?: boolean;
}

function mergeSyncPages(
  current: InfiniteData<MailboxSyncResponse> | undefined,
  incoming: MailboxDescriptor[],
  deletedIds: string[],
  counts: MailboxSyncResponse["counts"],
  syncCursor: string,
): InfiniteData<MailboxSyncResponse> {
  const existing = current?.pages.flatMap((page) => page.items) ?? [];
  const merged = capMailboxWindow(
    mergeMailboxDescriptors(existing, incoming, deletedIds),
    MAILBOX_RENDER_CAP,
  );
  const last = current?.pages.at(-1);
  return {
    pageParams: current?.pageParams?.length ? current.pageParams : [undefined],
    pages: [
      {
        items: merged,
        deletedIds: [],
        nextCursor: last?.nextCursor ?? null,
        hasMore: last?.hasMore ?? false,
        syncCursor,
        counts,
      },
    ],
  };
}

export function useMailboxSync({
  actor,
  enabled = true,
  online = true,
  visible = true,
}: UseMailboxSyncOptions) {
  const queryClient = useQueryClient();
  const tabIdRef = useRef(`tab_${Math.random().toString(36).slice(2, 10)}`);
  const pausedRef = useRef(false);
  const syncKey = queryKeys.mailbox.sync(actor);
  const countsKey = queryKeys.mailbox.counts(actor);
  const paused = shouldPauseSync(online, visible);
  const liveEnabled = enabled && online;

  const listQuery = useInfiniteQuery({
    queryKey: syncKey,
    queryFn: ({ pageParam, signal }) =>
      api.mailbox.sync({ cursor: pageParam, limit: MAILBOX_PAGE_SIZE }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    enabled,
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: false,
    retry: online ? 2 : 0,
  });

  const latestPage = listQuery.data?.pages.at(-1);
  const firstPage = listQuery.data?.pages[0];

  useEffect(() => {
    const cursor = latestPage?.syncCursor;
    if (!enabled || !actor || !cursor) return;
    writeSyncCursor(actor, cursor);
  }, [actor, enabled, latestPage?.syncCursor]);

  const sinceCursor = enabled ? readSyncCursor(actor) : null;

  const deltaQuery = useQuery({
    queryKey: queryKeys.mailbox.delta(actor),
    queryFn: ({ signal }) => {
      const since = readSyncCursor(actor);
      if (!since) return null;
      return api.mailbox.sync({ sinceCursor: since, limit: 100 }, signal);
    },
    enabled: liveEnabled && Boolean(sinceCursor),
    refetchInterval: paused ? false : MAILBOX_DELTA_INTERVAL_MS,
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: false,
  });

  const countsQuery = useQuery({
    queryKey: countsKey,
    queryFn: ({ signal }) => api.mailbox.getCounts(signal),
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: false,
    retry: online ? 2 : 0,
  });

  // BETA-074 — a stable latest-page snapshot held in a ref so the broadcast
  // channel and mutation handlers do not need to be torn down/recreated on
  // every sync page change (avoids repeated BroadcastChannel churn).
  const latestRef = useRef<{
    counts: MailboxCounts | null;
    syncCursor: string;
  }>({ counts: null, syncCursor: "" });
  const resolvedCounts =
    latestPage?.counts ?? firstPage?.counts ?? countsQuery.data?.counts ?? null;
  const resolvedCursor =
    latestPage?.syncCursor ?? firstPage?.syncCursor ?? readSyncCursor(actor) ?? "";
  useEffect(() => {
    latestRef.current = { counts: resolvedCounts, syncCursor: resolvedCursor };
  }, [resolvedCounts, resolvedCursor]);

  useEffect(() => {
    const delta = deltaQuery.data;
    if (!delta) return;
    writeSyncCursor(actor, delta.syncCursor);
    // BETA-074 — batch the cache updates: advance counts unconditionally but
    // only rewrite the (larger) mailbox list when the delta actually changed
    // rows, and only notify count subscribers when the numbers differ. This
    // keeps the every-15s poll from re-rendering the whole mailbox when
    // nothing changed.
    const existingCounts = queryClient.getQueryData<{ counts: MailboxCounts }>(countsKey);
    if (!existingCounts || !countsEqual(existingCounts.counts, delta.counts)) {
      queryClient.setQueryData(countsKey, { counts: delta.counts });
    }
    if (delta.items.length === 0 && delta.deletedIds.length === 0) return;
    queryClient.setQueryData(syncKey, (current: InfiniteData<MailboxSyncResponse> | undefined) =>
      mergeSyncPages(current, delta.items, delta.deletedIds, delta.counts, delta.syncCursor),
    );
  }, [actor, countsKey, deltaQuery.dataUpdatedAt, deltaQuery.data, queryClient, syncKey]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(MAILBOX_SYNC_CHANNEL);
    } catch {
      return;
    }

    channel.onmessage = (event: MessageEvent<MailboxBroadcast>) => {
      const message = event.data;
      if (!message || message.actor !== actor || message.tabId === tabIdRef.current) return;
      if (message.type === "MAILBOX_MUTATION") {
        const { counts, syncCursor } = latestRef.current;
        queryClient.setQueryData(
          syncKey,
          (current: InfiniteData<MailboxSyncResponse> | undefined) =>
            mergeSyncPages(
              current,
              [message.descriptor],
              message.descriptor.isTombstone ? [message.descriptor.messageId] : [],
              counts ?? emptyCountsFallback(),
              syncCursor,
            ),
        );
        void queryClient.invalidateQueries({ queryKey: countsKey });
        void queryClient.invalidateQueries({ queryKey: queryKeys.mailbox.delta(actor) });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.mailbox.all });
    };

    return () => {
      channel.close();
    };
  }, [actor, countsKey, queryClient, syncKey]);

  const patchMutation = useMutation({
    mutationFn: ({ messageId, patch }: { messageId: string; patch: MailboxFlagsPatch }) =>
      api.mailbox.patchFlags(messageId, patch),
    onSuccess: async (descriptor) => {
      const { counts, syncCursor } = latestRef.current;
      queryClient.setQueryData(syncKey, (current: InfiniteData<MailboxSyncResponse> | undefined) =>
        mergeSyncPages(
          current,
          [descriptor],
          descriptor.isTombstone ? [descriptor.messageId] : [],
          counts ?? emptyCountsFallback(),
          syncCursor,
        ),
      );
      for (const key of cacheInvalidations.patchMailboxFlags(actor)) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
      broadcast({
        type: "MAILBOX_MUTATION",
        actor,
        tabId: tabIdRef.current,
        descriptor,
      });
    },
  });

  const descriptors = useMemo(() => {
    const flat = listQuery.data?.pages.flatMap((page) => page.items) ?? [];
    return capMailboxWindow(flat, MAILBOX_RENDER_CAP);
  }, [listQuery.data]);

  const emails = useMemo(() => descriptors.map(mailboxDescriptorToEmail), [descriptors]);
  const atCap =
    (listQuery.data?.pages.flatMap((page) => page.items).length ?? 0) >= MAILBOX_RENDER_CAP;
  const hasMore = !atCap && Boolean(latestPage?.hasMore);
  const counts = latestPage?.counts ?? firstPage?.counts ?? countsQuery.data?.counts ?? null;

  const refetch = useCallback(async () => {
    await Promise.all([listQuery.refetch(), countsQuery.refetch(), deltaQuery.refetch()]);
  }, [countsQuery, deltaQuery, listQuery]);

  useEffect(() => {
    const resume = shouldResumeSync(pausedRef.current, paused);
    pausedRef.current = paused;
    if (!resume || !enabled) return;
    void refetch();
  }, [enabled, paused, refetch]);

  return {
    emails,
    counts,
    hasMore,
    fetchNextPage: listQuery.fetchNextPage,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    isFetched: listQuery.isFetched,
    isError: listQuery.isError,
    error: listQuery.error,
    refetch,
    patchFlags: patchMutation.mutateAsync,
  };
}

function emptyCountsFallback() {
  return {
    inbox: 0,
    requests: 0,
    sent: 0,
    drafts: 0,
    outbox: 0,
    archive: 0,
    spam: 0,
    trash: 0,
    unread: 0,
    starred: 0,
  };
}

function countsEqual(a: MailboxCounts | null | undefined, b: MailboxCounts): boolean {
  if (!a) return false;
  return (
    a.inbox === b.inbox &&
    a.requests === b.requests &&
    a.sent === b.sent &&
    a.drafts === b.drafts &&
    a.outbox === b.outbox &&
    a.archive === b.archive &&
    a.spam === b.spam &&
    a.trash === b.trash &&
    a.unread === b.unread &&
    a.starred === b.starred
  );
}

function broadcast(message: MailboxBroadcast) {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(MAILBOX_SYNC_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // Ignore broadcast failures; polling still reconciles.
  }
}
