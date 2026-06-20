import { useState, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Wallet, Globe, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WalletHook } from "./useWallet";

export function WalletStatusPill({
  wallet,
  onViewAccount,
  onShowToast,
}: {
  wallet: WalletHook;
  onViewAccount?: (address: string) => void;
  onShowToast?: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (open && ref.current) setRect(ref.current.getBoundingClientRect());
  }, [open]);

  const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

  const handleConnect = async () => {
    await wallet.connect();
    if (wallet.freighter.status === "connected") {
      onShowToast?.("Wallet connected");
    }
  };

  const handleDisconnect = () => {
    wallet.disconnect();
    onShowToast?.("Wallet disconnected");
  };

  const handleSwitchNetwork = () => {
    const newNetwork = wallet.network === "mainnet" ? "testnet" : "mainnet";
    wallet.switchNetwork(newNetwork);
    onShowToast?.(`Switched to ${newNetwork}`);
  };

  const isConnected = wallet.freighter.status === "connected";
  const isConnecting = wallet.freighter.status === "connecting";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isConnecting}
        className={cn(
          "flex items-center gap-2 rounded-[6px] border px-2.5 py-1.5 text-xs transition",
          wallet.mismatch
            ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-400"
            : isConnected
              ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400"
              : "border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground",
          isConnecting && "opacity-50 cursor-not-allowed",
        )}
      >
        {isConnected ? (
          wallet.mismatch ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )
        ) : (
          <Wallet className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">
          {isConnected
            ? shortAddress(wallet.freighter.address)
            : isConnecting
              ? "Connecting…"
              : "Connect wallet"}
        </span>
        <div className="hidden sm:flex items-center gap-1">
          <span className="text-[10px] opacity-60">{wallet.network === "mainnet" ? "Mainnet" : "Testnet"}</span>
          <Globe className="h-3 w-3 opacity-40" />
        </div>
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl"
                />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  style={{
                    position: "fixed",
                    top: rect ? rect.bottom + 8 : 64,
                    right: rect ? Math.max(8, window.innerWidth - rect.right) : 12,
                    width: 240,
                    zIndex: 110,
                  }}
                  className="glass-modal overflow-hidden rounded-xl"
                >
                  {wallet.mismatch && (
                    <div className="border-b border-amber-500/20 bg-amber-500/[0.08] p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-amber-400">{wallet.mismatch.message}</p>
                          <p className="text-[10px] text-amber-400/80 mt-1">{wallet.mismatch.recovery}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-1">
                    {isConnected ? (
                      <>
                        <MenuItem
                          label="View account"
                          icon={ExternalLink}
                          onClick={() => {
                            setOpen(false);
                            onViewAccount?.(wallet.freighter.address);
                          }}
                        />
                        <MenuItem label="Switch network" onClick={handleSwitchNetwork} />
                        <div className="my-1 border-t border-white/5" />
                        <MenuItem label="Disconnect" onClick={handleDisconnect} destructive />
                      </>
                    ) : (
                      <MenuItem label="Connect Freighter" onClick={handleConnect} disabled={isConnecting} />
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  disabled,
  destructive,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  icon?: typeof ExternalLink;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
        destructive
          ? "text-red-400 hover:bg-red-500/[0.08]"
          : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}