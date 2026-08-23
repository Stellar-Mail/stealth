/* eslint-disable no-useless-catch */
import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sharedTypedApi, queryKeys } from "@/lib/api";
import { isApiClientError } from "@/lib/api/errors";
import { validatePolicyWrite, computeDirtyFields, policiesEqual } from "@/lib/policy-validation";
import type {
  MailboxPolicy,
  MailboxPolicyWrite,
  PolicyReconciliation,
  PolicyReconciliationState,
  PolicyWriteIntent,
  SenderRule,
} from "@/lib/api/types";

export interface PolicyEditorState {
  // Data
  livePolicy: MailboxPolicy | null;
  draftPolicy: MailboxPolicyWrite;
  version: number | null;

  // Status
  isLoading: boolean;
  isError: boolean;
  reconciliationState: PolicyReconciliationState | null;
  writeIntent: PolicyWriteIntent | null;

  // Editor state
  isDirty: boolean;
  dirtyFields: string[];
  validationErrors: Record<string, string>;
  isSaving: boolean;
  hasConflict: boolean;
  saveError: string | null;

  // Actions
  updateDraft: (updates: Partial<MailboxPolicyWrite>) => void;
  saveDraft: (policy?: MailboxPolicyWrite) => Promise<void>;
  reload: () => void;
  resetDraft: () => void;

  // Sender rules (basic support)
  getSenderRule: (sender: string) => Promise<SenderRule>;
  setSenderRule: (sender: string, rule: SenderRule) => Promise<void>;
}

export function usePolicyEditor(address?: string): PolicyEditorState {
  const queryClient = useQueryClient();

  // Queries
  const {
    data: reconciliation,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: address ? queryKeys.policies.reconciliation(address) : [],
    queryFn: ({ signal }) => sharedTypedApi.policies.getReconciliation(address!, undefined, signal),
    enabled: !!address,
  });

  const defaultPolicy: MailboxPolicy = {
    allowUnknown: true,
    requireVerified: false,
    minimumPostage: "0.01", // Fallback, normally overridden by server
  };

  const livePolicy = reconciliation?.offchain.policy ?? defaultPolicy;
  const version = reconciliation?.offchain.version ?? null;

  // Local draft state
  const [draftPolicy, setDraftPolicy] = useState<MailboxPolicyWrite>(livePolicy);

  // Sync draft with remote when remote loads/changes (but avoid overriding active edits unless forced)
  // For simplicity in this unified hook, we'll sync if the version changes.
  useEffect(() => {
    if (reconciliation?.offchain.policy) {
      setDraftPolicy({
        ...reconciliation.offchain.policy,
        minimumPostage: reconciliation.offchain.policy.minimumPostage,
      });
    }
  }, [reconciliation?.offchain.policy, reconciliation?.offchain.version]);

  // Derived state
  const isDirty = useMemo(() => {
    if (!reconciliation?.offchain.policy) return false;
    return !policiesEqual(draftPolicy as MailboxPolicy, reconciliation.offchain.policy);
  }, [draftPolicy, reconciliation?.offchain.policy]);

  const dirtyFields = useMemo(() => {
    if (!reconciliation?.offchain.policy) return [];
    return computeDirtyFields(draftPolicy as MailboxPolicy, reconciliation.offchain.policy);
  }, [draftPolicy, reconciliation?.offchain.policy]);

  const validationErrors = useMemo(() => validatePolicyWrite(draftPolicy), [draftPolicy]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (policyToSave: MailboxPolicyWrite) =>
      sharedTypedApi.policies.update(address!, {
        ...policyToSave,
        version: version ?? undefined, // Optimistic concurrency
      }),
    onSuccess: () => {
      if (address) {
        queryClient.invalidateQueries({ queryKey: queryKeys.policies.reconciliation(address) });
        queryClient.invalidateQueries({ queryKey: queryKeys.policies.policy(address) });
      }
    },
  });

  const ruleMutation = useMutation({
    mutationFn: ({ sender, rule }: { sender: string; rule: SenderRule }) =>
      sharedTypedApi.policies.setRule(address!, sender, rule),
  });

  // Actions
  const updateDraft = useCallback((updates: Partial<MailboxPolicyWrite>) => {
    setDraftPolicy((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveDraft = useCallback(
    async (overridePolicy?: MailboxPolicyWrite) => {
      if (!address) return;
      const policyToSave = overridePolicy ?? draftPolicy;
      const errors = validatePolicyWrite(policyToSave);
      if (Object.keys(errors).length > 0) {
        // Validation failed, let the UI show the errors
        throw new Error("Validation failed");
      }

      try {
        await updateMutation.mutateAsync(policyToSave);
        // On success, update local draft if an override was provided
        if (overridePolicy) {
          setDraftPolicy(overridePolicy);
        }
      } catch (e) {
        // Rethrow for UI to handle (e.g. toasts)
        throw e;
      }
    },
    [address, draftPolicy, updateMutation],
  );

  const resetDraft = useCallback(() => {
    if (reconciliation?.offchain.policy) {
      setDraftPolicy(reconciliation.offchain.policy);
    } else {
      setDraftPolicy(defaultPolicy);
    }
  }, [reconciliation?.offchain.policy]);

  const reload = useCallback(() => {
    refetch();
  }, [refetch]);

  const getSenderRule = useCallback(
    async (sender: string) => {
      if (!address) return "default" as SenderRule;
      const res = await sharedTypedApi.policies.getRule(address, sender);
      return res.rule;
    },
    [address],
  );

  const setSenderRule = useCallback(
    async (sender: string, rule: SenderRule) => {
      if (!address) return;
      await ruleMutation.mutateAsync({ sender, rule });
    },
    [address, ruleMutation],
  );

  const hasConflict =
    updateMutation.isError &&
    isApiClientError(updateMutation.error) &&
    updateMutation.error.status === 409;

  let saveError: string | null = null;
  if (updateMutation.isError && !hasConflict) {
    saveError =
      updateMutation.error instanceof Error
        ? updateMutation.error.message
        : "Failed to save policy";
  }

  // Use explicit failed state mapped from writeIntent if needed, though reconciliationState should handle it
  // Beta-061: the server might report "pending_write" for both pending and failed. The client type handles "failed".
  // Let's rely on the writeIntent for explicit failed state if reconciliationState isn't enough.
  let state = reconciliation?.state ?? null;
  if (state === "pending_write" && reconciliation?.writeIntent?.status === "failed") {
    state = "failed"; // Manually elevate failed state if the server groups them
  }

  return {
    livePolicy: reconciliation?.offchain.policy ?? null,
    draftPolicy,
    version,
    isLoading,
    isError,
    reconciliationState: state,
    writeIntent: reconciliation?.writeIntent ?? null,
    isDirty,
    dirtyFields,
    validationErrors,
    isSaving: updateMutation.isPending,
    hasConflict,
    saveError,
    updateDraft,
    saveDraft,
    reload,
    resetDraft,
    getSenderRule,
    setSenderRule,
  };
}
