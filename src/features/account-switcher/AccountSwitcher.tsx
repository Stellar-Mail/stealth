import { useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Plus,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  X,
  Check,
  Globe,
  Beaker,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccountSwitcher } from "./AccountSwitcherContext";
import type { AccountProfile, NetworkType } from "./types";

/* -------------------------------------------------------------------------- */
/*  Confirm switch dialog                                                      */
/* -------------------------------------------------------------------------- */

function ConfirmSwitchDialog({
  open,
  onClose,
  onConfirm,
  targetLabel,
  warnings,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  targetLabel: string;
  warnings: string[];
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-modal fixed left-1/2 top-1/2 z-[210] w-[360px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl p-0 shadow-2xl"
          >
            <div className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/10">
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Switch to {targetLabel}?
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    There are items that need attention
                  </p>
                </div>
              </div>

              <ul className="mb-4 space-y-2">
                {warnings.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    {w}
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/20"
                >
                  Switch anyway
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/*  Add / edit account dialog                                                  */
/* -------------------------------------------------------------------------- */

function AddAccountDialog({
  open,
  onClose,
  onSave,
  editAccount,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    label: string;
    address: string;
    federationAddress?: string;
    network: NetworkType;
    avatarInitials: string;
    avatarColor: string;
  }) => void;
  editAccount?: AccountProfile | null;
}) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [federationAddress, setFederationAddress] = useState("");
  const [network, setNetwork] = useState<NetworkType>("testnet");
  const [avatarInitials, setAvatarInitials] = useState("");

  useEffect(() => {
    if (editAccount) {
      setLabel(editAccount.label);
      setAddress(editAccount.address);
      setFederationAddress(editAccount.federationAddress ?? "");
      setNetwork(editAccount.network);
      setAvatarInitials(editAccount.avatarInitials);
    } else if (open) {
      setLabel("");
      setAddress("");
      setFederationAddress("");
      setNetwork("testnet");
      setAvatarInitials("");
    }
  }, [editAccount, open]);

  const handleSave = () => {
    if (!label.trim() || !address.trim()) return;
    onSave({
      label: label.trim(),
      address: address.trim(),
      federationAddress: federationAddress.trim() || undefined,
      network,
      avatarInitials: avatarInitials.trim() || label.trim().slice(0, 2).toUpperCase(),
      avatarColor: generateAvatarColor(),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-modal fixed left-1/2 top-1/2 z-[210] w-[400px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl p-0 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <h3 className="text-sm font-medium text-foreground">
                {editAccount ? "Edit account" : "Add account"}
              </h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-5">
              <Field label="Label" value={label} onChange={setLabel} placeholder="e.g. Work" />
              <Field
                label="Address"
                value={address}
                onChange={setAddress}
                placeholder="GABCD…1234 or alias*domain"
              />
              {network === "testnet" && (
                <Field
                  label="Federation (optional)"
                  value={federationAddress}
                  onChange={setFederationAddress}
                  placeholder="alias*testnet.domain"
                />
              )}

              <div>
                <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
                  Network
                </span>
                <div className="flex gap-2">
                  {(["testnet", "mainnet"] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setNetwork(n)}
                      className={cn(
                        "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs transition",
                        network === n
                          ? "border-white/20 bg-white/[0.08] text-foreground"
                          : "border-white/5 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
                      )}
                    >
                      {n === "testnet" ? (
                        <Beaker className="h-3.5 w-3.5" />
                      ) : (
                        <Globe className="h-3.5 w-3.5" />
                      )}
                      {n === "testnet" ? "Testnet" : "Mainnet"}
                    </button>
                  ))}
                </div>
              </div>

              <Field
                label="Initials"
                value={avatarInitials}
                onChange={setAvatarInitials}
                placeholder="e.g. EN"
                maxLength={3}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-3">
              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!label.trim() || !address.trim()}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editAccount ? "Save" : "Add account"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const AVATAR_COLORS = [
  "#4d5560",
  "#5b6470",
  "#6b7280",
  "#7a8290",
  "#3d434d",
  "#6366f1",
  "#8b5cf6",
  "#06b6d4",
];

function generateAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <div>
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        type={type}
        className="glow-ring w-full rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-white/20"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sync state indicator                                                       */
/* -------------------------------------------------------------------------- */

const SYNC_ICONS: Record<string, LucideIcon> = {
  synced: Check,
  syncing: Loader2,
  error: AlertTriangle,
  offline: WifiOff,
};

const SYNC_COLORS: Record<string, string> = {
  synced: "text-emerald-400",
  syncing: "text-blue-400",
  error: "text-red-400",
  offline: "text-muted-foreground",
};

function SyncIndicator({ state }: { state: string }) {
  const Icon = SYNC_ICONS[state] ?? WifiOff;
  return (
    <Icon
      className={cn(
        "h-3 w-3",
        SYNC_COLORS[state] ?? "text-muted-foreground",
        state === "syncing" && "animate-spin",
      )}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Main AccountSwitcher component                                             */
/* -------------------------------------------------------------------------- */

export function AccountSwitcher({
  open,
  onClose,
  anchorRect,
}: {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
}) {
  const {
    accounts,
    activeId,
    activeAccount,
    setActiveAccount,
    addAccount,
    removeAccount,
    renameAccount,
    togglePin,
    draftState,
    isSwitchSafe,
  } = useAccountSwitcher();

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<AccountProfile | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const sorted = [...accounts].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  const handleSwitch = useCallback(
    (targetId: string) => {
      if (targetId === activeId) {
        onClose();
        return;
      }

      const buildWarnings = (): string[] => {
        const w: string[] = [];
        if (draftState.hasUnsentDrafts) {
          w.push("You have unsent drafts in the current account.");
        }
        if (draftState.hasPendingApprovals) {
          w.push("There are pending approvals in the current account.");
        }
        return w;
      };

      const warnings = buildWarnings();
      if (warnings.length > 0) {
        setPendingSwitchId(targetId);
        setShowConfirm(true);
      } else {
        setActiveAccount(targetId);
        onClose();
      }
    },
    [activeId, draftState, setActiveAccount, onClose],
  );

  const handleConfirmSwitch = useCallback(() => {
    if (pendingSwitchId) {
      setActiveAccount(pendingSwitchId);
    }
    setShowConfirm(false);
    setPendingSwitchId(null);
    onClose();
  }, [pendingSwitchId, setActiveAccount, onClose]);

  const handleAdd = useCallback(
    (data: {
      label: string;
      address: string;
      federationAddress?: string;
      network: NetworkType;
      avatarInitials: string;
      avatarColor: string;
    }) => {
      addAccount(data);
    },
    [addAccount],
  );

  const handleEdit = useCallback(
    (data: {
      label: string;
      address: string;
      federationAddress?: string;
      network: NetworkType;
      avatarInitials: string;
      avatarColor: string;
    }) => {
      if (editTarget) {
        renameAccount(editTarget.id, data.label);
      }
    },
    [editTarget, renameAccount],
  );

  const handleRemove = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      // Don't allow removing the last account
      if (accounts.length <= 1) return;
      removeAccount(id);
      // If the active account got removed, the effect in useAccounts handles fallback
    },
    [accounts.length, removeAccount],
  );

  const startRename = useCallback(
    (id: string, currentLabel: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setRenamingId(id);
      setRenameValue(currentLabel);
    },
    [],
  );

  const submitRename = useCallback(
    (id: string) => {
      const trimmed = renameValue.trim();
      if (trimmed) renameAccount(id, trimmed);
      setRenamingId(null);
      setRenameValue("");
    },
    [renameValue, renameAccount],
  );

  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={onClose}
                  className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl"
                />
                {/* Dropdown */}
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  style={{
                    position: "fixed",
                    top: anchorRect ? anchorRect.bottom + 8 : 64,
                    right: anchorRect
                      ? Math.max(8, window.innerWidth - anchorRect.right)
                      : 12,
                    width: 320,
                    zIndex: 110,
                  }}
                  className="glass-modal overflow-hidden rounded-xl shadow-2xl"
                >
                  {/* Active account header */}
                  {activeAccount && (
                    <div className="border-b border-white/5 p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                          style={{ background: activeAccount.avatarColor }}
                        >
                          <span className="text-sm font-medium text-white/90">
                            {activeAccount.avatarInitials}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {activeAccount.label}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {activeAccount.federationAddress ?? activeAccount.address}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider",
                              activeAccount.network === "mainnet"
                                ? "bg-emerald-300/10 text-emerald-300"
                                : "bg-blue-300/10 text-blue-300",
                            )}
                          >
                            {activeAccount.network === "mainnet" ? (
                              <Globe className="h-2.5 w-2.5" />
                            ) : (
                              <Beaker className="h-2.5 w-2.5" />
                            )}
                            {activeAccount.network === "mainnet" ? "Mainnet" : "Testnet"}
                          </span>
                          <SyncIndicator state={activeAccount.syncState} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Account list */}
                  <div className="max-h-[280px] overflow-y-auto p-1.5">
                    {sorted.map((account) => {
                      const isActive = account.id === activeId;
                      return (
                        <div
                          key={account.id}
                          onClick={() => handleSwitch(account.id)}
                          className={cn(
                            "group relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition",
                            isActive
                              ? "bg-white/[0.08]"
                              : "hover:bg-white/[0.04]",
                          )}
                        >
                          <div
                            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                            style={{ background: account.avatarColor }}
                          >
                            <span className="text-xs font-medium text-white/90">
                              {account.avatarInitials}
                            </span>
                            {isActive && (
                              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[oklch(0.22_0.01_270)] bg-emerald-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            {renamingId === account.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") submitRename(account.id);
                                    if (e.key === "Escape") setRenamingId(null);
                                  }}
                                  onBlur={() => submitRename(account.id)}
                                  className="w-full rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <>
                                <p className="truncate text-sm text-foreground">
                                  {account.label}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {account.federationAddress ?? account.address}
                                </p>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <SyncIndicator state={account.syncState} />
                          </div>

                          {/* Hover actions */}
                          <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                            <button
                              onClick={(e) => startRename(account.id, account.label, e)}
                              className="rounded p-1 text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
                              aria-label={`Rename ${account.label}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(account.id);
                              }}
                              className="rounded p-1 text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
                              aria-label={account.isPinned ? "Unpin" : "Pin"}
                            >
                              {account.isPinned ? (
                                <PinOff className="h-3 w-3" />
                              ) : (
                                <Pin className="h-3 w-3" />
                              )}
                            </button>
                            {accounts.length > 1 && (
                              <button
                                onClick={(e) => handleRemove(account.id, e)}
                                className="rounded p-1 text-muted-foreground transition hover:bg-white/[0.08] hover:text-red-400"
                                aria-label={`Remove ${account.label}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add account button */}
                  <div className="border-t border-white/5 p-1.5">
                    <button
                      onClick={() => {
                        setEditTarget(null);
                        setShowAddDialog(true);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/20">
                        <Plus className="h-4 w-4" />
                      </div>
                      <span>Add account</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* Confirm switch dialog */}
      <ConfirmSwitchDialog
        open={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingSwitchId(null);
        }}
        onConfirm={handleConfirmSwitch}
        targetLabel={
          accounts.find((a) => a.id === pendingSwitchId)?.label ?? ""
        }
        warnings={[
          ...(draftState.hasUnsentDrafts
            ? ["You have unsent drafts in the current account."]
            : []),
          ...(draftState.hasPendingApprovals
            ? ["There are pending approvals in the current account."]
            : []),
        ]}
      />

      {/* Add / Edit account dialog */}
      <AddAccountDialog
        open={showAddDialog || !!editTarget}
        onClose={() => {
          setShowAddDialog(false);
          setEditTarget(null);
        }}
        onSave={editTarget ? handleEdit : handleAdd}
        editAccount={editTarget}
      />
    </>
  );
}