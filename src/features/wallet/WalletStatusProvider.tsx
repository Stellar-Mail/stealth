import { createContext, useContext, ReactNode } from "react";
import { useWallet, type WalletHook } from "./useWallet";

const WalletStatusContext = createContext<WalletHook | null>(null);

export function WalletStatusProvider({
  children,
  actorAddress,
}: {
  children: ReactNode;
  actorAddress?: string | null;
}) {
  const wallet = useWallet({ actorAddress });
  return <WalletStatusContext.Provider value={wallet}>{children}</WalletStatusContext.Provider>;
}

export function useWalletStatus(): WalletHook {
  const context = useContext(WalletStatusContext);
  if (!context) {
    throw new Error("useWalletStatus must be used within WalletStatusProvider");
  }
  return context;
}