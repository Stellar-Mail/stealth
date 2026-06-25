import { useState, useCallback } from "react";
import type { AccountSwitcherDraftState } from "./types";

const DEFAULT_DRAFT_STATE: AccountSwitcherDraftState = {
  hasUnsentDrafts: false,
  hasPendingApprovals: false,
};

export type UseDraftStateReturn = {
  draftState: AccountSwitcherDraftState;
  setHasUnsentDrafts: (value: boolean) => void;
  setHasPendingApprovals: (value: boolean) => void;
  /** Returns true if switching is safe (no warnings needed). */
  isSwitchSafe: () => boolean;
};

export function useDraftState(): UseDraftStateReturn {
  const [draftState, setDraftState] =
    useState<AccountSwitcherDraftState>(DEFAULT_DRAFT_STATE);

  const setHasUnsentDrafts = useCallback((value: boolean) => {
    setDraftState((prev) => ({ ...prev, hasUnsentDrafts: value }));
  }, []);

  const setHasPendingApprovals = useCallback((value: boolean) => {
    setDraftState((prev) => ({ ...prev, hasPendingApprovals: value }));
  }, []);

  const isSwitchSafe = useCallback(() => {
    return !draftState.hasUnsentDrafts && !draftState.hasPendingApprovals;
  }, [draftState]);

  return {
    draftState,
    setHasUnsentDrafts,
    setHasPendingApprovals,
    isSwitchSafe,
  };
}