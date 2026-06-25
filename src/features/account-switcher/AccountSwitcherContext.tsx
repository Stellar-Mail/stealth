import { createContext, useContext, type ReactNode } from "react";
import { useAccounts, type UseAccountsReturn } from "./useAccounts";
import { useDraftState, type UseDraftStateReturn } from "./useDraftState";

type AccountSwitcherContextValue = UseAccountsReturn & UseDraftStateReturn;

const AccountSwitcherContext = createContext<AccountSwitcherContextValue | null>(null);

export function AccountSwitcherProvider({ children }: { children: ReactNode }) {
  const accounts = useAccounts();
  const drafts = useDraftState();

  return (
    <AccountSwitcherContext.Provider value={{ ...accounts, ...drafts }}>
      {children}
    </AccountSwitcherContext.Provider>
  );
}

export function useAccountSwitcher(): AccountSwitcherContextValue {
  const ctx = useContext(AccountSwitcherContext);
  if (!ctx) {
    throw new Error(
      "useAccountSwitcher must be used within an <AccountSwitcherProvider>",
    );
  }
  return ctx;
}