import { useState, useEffect } from "react";
import { AlertTriangle, Check, Link2, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExternalWallet, WalletCapability } from "@/server/api/domain";
import {
  requestChallenge,
  verifyAndLink,
  listLinkedWallets,
  unlinkWallet,
  WalletLinkError,
} from "@/services/stellar/wallet-link";

let _freighterMod: typeof import("@stellar/freighter-api") | null = null;
async function freighterApi() {
  if (!_freighterMod) {
    const mod = await import("@stellar/freighter-api");
    _freighterMod = (mod.default ?? mod) as typeof import("@stellar/freighter-api");
  }
  return _freighterMod;
}

type LinkingState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "challenged"; challenge: string; expiresAt: string }
  | { status: "signing" }
  | { status: "verifying" }
  | { status: "linked" }
  | { status: "error"; message: string };

const CAPABILITY_LABELS: Record<WalletCapability, { label: string; description: string }> = {
  sign: { label: "Sign messages", description: "Prove ownership of the external address" },
  send: { label: "Send transactions", description: "Submit transactions from the linked wallet" },
  read: { label: "Read access", description: "View balance and transaction history" },
};

const NETWORKS = [
  { passphrase: "Public Global Stellar Network ; September 2015", label: "Mainnet" },
  { passphrase: "Test SDF Network ; September 2015", label: "Testnet" },
] as const;

export function ExternalWalletSettings({ ownerAddress }: { ownerAddress?: string }) {
  const [wallets, setWallets] = useState<ExternalWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingState, setLinkingState] = useState<LinkingState>({ status: "idle" });
  const [selectedCapabilities, setSelectedCapabilities] = useState<WalletCapability[]>(["sign"]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>(NETWORKS[0].passphrase);
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);

  useEffect(() => {
    loadWallets();
  }, []);

  async function loadWallets() {
    try {
      setLoading(true);
      const linked = await listLinkedWallets();
      setWallets(linked);
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setLinkingState({ status: "connecting" });

    try {
      const freighter = await freighterApi();

      const connected = await freighter.isConnected();
      if (!connected.isConnected) {
        setLinkingState({
          status: "error",
          message: "Freighter wallet is not installed or connected",
        });
        return;
      }

      const access = await freighter.requestAccess();
      if (access.error) {
        setLinkingState({
          status: "error",
          message: access.error.message || "Failed to access wallet",
        });
        return;
      }

      const externalAddress = access.address;

      const challengeResult = await requestChallenge(externalAddress, selectedNetwork);
      setLinkingState({
        status: "challenged",
        challenge: challengeResult.challenge,
        expiresAt: challengeResult.expiresAt,
      });

      setLinkingState({ status: "signing" });

      const signed = await freighter.signMessage(challengeResult.challenge);
      if (signed.error) {
        setLinkingState({
          status: "error",
          message: signed.error.message || "Failed to sign challenge",
        });
        return;
      }

      const signature =
        typeof signed.signedMessage === "string"
          ? signed.signedMessage
          : Array.isArray(signed.signedMessage)
            ? Array.from(signed.signedMessage, (b: number) => b.toString(16).padStart(2, "0")).join(
                "",
              )
            : "";

      setLinkingState({ status: "verifying" });

      const wallet = await verifyAndLink(
        externalAddress,
        signature,
        selectedCapabilities,
        selectedNetwork,
      );

      setWallets((prev) => [...prev, wallet]);
      setLinkingState({ status: "linked" });
      setTimeout(() => setLinkingState({ status: "idle" }), 2000);
    } catch (err) {
      const message =
        err instanceof WalletLinkError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to connect wallet";
      setLinkingState({ status: "error", message });
    }
  }

  async function handleUnlink(address: string) {
    try {
      await unlinkWallet(address, { confirm: true });
      setWallets((prev) => prev.filter((w) => w.address !== address));
      setConfirmUnlink(null);
    } catch (err) {
      const message = err instanceof WalletLinkError ? err.message : "Failed to unlink wallet";
      setLinkingState({ status: "error", message });
    }
  }

  function toggleCapability(cap: WalletCapability) {
    setSelectedCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  }

  const isProcessing = ["connecting", "challenged", "signing", "verifying"].includes(
    linkingState.status,
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">External wallets</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Optionally connect a Freighter wallet to prove control of an external Stellar address.
          This does not change how you sign in.
        </p>
      </div>

      {/* Managed Wallet default signer status */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-400" />
          <div>
            <p className="text-xs font-medium text-foreground">Managed Wallet (Default Signer)</p>
            <p className="text-[11px] text-muted-foreground">
              {ownerAddress ? `Address: ${ownerAddress}` : "Active primary transaction signer"}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400 font-medium">
          Default
        </span>
      </div>

      {/* Linked wallets list */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-xs text-muted-foreground">
            Loading linked wallets...
          </div>
        ) : wallets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <Wallet className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-xs text-muted-foreground">No external wallets linked yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <div
                key={wallet.address}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                    <Link2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <code className="text-xs text-foreground">{wallet.address}</code>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {wallet.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {CAPABILITY_LABELS[cap].label}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Linked {new Date(wallet.linkedAt).toLocaleDateString()} on{" "}
                      {NETWORKS.find((n) => n.passphrase === wallet.network)?.label ??
                        wallet.network}
                    </p>
                  </div>
                </div>
                {confirmUnlink === wallet.address ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] text-red-400 font-medium">
                      Revoke tokens and fall back to managed wallet?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUnlink(wallet.address)}
                        className="rounded-lg bg-red-500 px-2 py-1 text-[10px] text-white hover:bg-red-600 transition font-medium"
                      >
                        Confirm Unlink
                      </button>
                      <button
                        onClick={() => setConfirmUnlink(null)}
                        className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-muted-foreground hover:bg-white/[0.06] transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmUnlink(wallet.address)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect new wallet */}
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-foreground">Connect new wallet</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Select the network and permissions before connecting.
          </p>
        </div>

        {/* Network selection */}
        <div>
          <label className="text-xs text-muted-foreground">Network</label>
          <div className="mt-2 flex gap-2">
            {NETWORKS.map((network) => (
              <button
                key={network.passphrase}
                onClick={() => setSelectedNetwork(network.passphrase)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-xs transition",
                  selectedNetwork === network.passphrase
                    ? "border-white/20 bg-white/[0.08] text-foreground"
                    : "border-white/5 text-muted-foreground hover:border-white/10 hover:text-foreground",
                )}
              >
                {network.label}
              </button>
            ))}
          </div>
        </div>

        {/* Capabilities selection */}
        <div>
          <label className="text-xs text-muted-foreground">Permitted capabilities</label>
          <div className="mt-2 space-y-2">
            {(
              Object.entries(CAPABILITY_LABELS) as [
                WalletCapability,
                { label: string; description: string },
              ][]
            ).map(([cap, { label, description }]) => (
              <button
                key={cap}
                onClick={() => toggleCapability(cap)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left transition",
                  selectedCapabilities.includes(cap)
                    ? "border-emerald-200/20 bg-emerald-200/[0.06]"
                    : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
                )}
              >
                <div>
                  <span className="block text-sm font-medium text-foreground">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
                </div>
                {selectedCapabilities.includes(cap) && (
                  <Check className="h-4 w-4 text-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={isProcessing || selectedCapabilities.length === 0}
          className={cn(
            "w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            isProcessing || selectedCapabilities.length === 0
              ? "cursor-not-allowed bg-white/[0.06] text-muted-foreground"
              : "bg-foreground text-background hover:opacity-90",
          )}
        >
          {linkingState.status === "connecting" && "Connecting to Freighter..."}
          {linkingState.status === "challenged" && "Awaiting signature..."}
          {linkingState.status === "signing" && "Signing challenge..."}
          {linkingState.status === "verifying" && "Verifying signature..."}
          {linkingState.status === "linked" && "Wallet linked successfully!"}
          {linkingState.status === "idle" && "Connect Freighter wallet"}
          {linkingState.status === "error" && "Retry connection"}
        </button>

        {/* Error display */}
        {linkingState.status === "error" && (
          <div className="rounded-lg border border-red-300/20 bg-red-300/[0.08] p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <p className="text-xs text-red-200">{linkingState.message}</p>
            </div>
          </div>
        )}

        {/* Network warning */}
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.08] p-3">
          <p className="text-[11px] text-amber-100/80">
            Linking an external wallet does not replace your login credentials or change your
            managed address. The linked wallet is stored separately and can be unlinked at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
