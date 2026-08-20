import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sharedTypedApi as api, queryKeys } from "@/lib/api";

export function usePostageActions(messageId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.postage.byMessage(messageId) });
  };

  const settle = useMutation({
    mutationFn: ({ signal }: { signal?: AbortSignal }) => api.postage.settle(messageId, signal),
    onSuccess: invalidate,
  });

  const refund = useMutation({
    mutationFn: ({ signal }: { signal?: AbortSignal }) => api.postage.refund(messageId, signal),
    onSuccess: invalidate,
  });

  const dispute = useMutation({
    mutationFn: ({ signal }: { signal?: AbortSignal }) => api.postage.dispute(messageId, signal),
    onSuccess: invalidate,
  });

  const expire = useMutation({
    mutationFn: ({ signal }: { signal?: AbortSignal }) => api.postage.expire(messageId, signal),
    onSuccess: invalidate,
  });

  const reclaim = useMutation({
    mutationFn: ({ signal }: { signal?: AbortSignal }) => api.postage.reclaim(messageId, signal),
    onSuccess: invalidate,
  });

  return {
    settle,
    refund,
    dispute,
    expire,
    reclaim,
  };
}
