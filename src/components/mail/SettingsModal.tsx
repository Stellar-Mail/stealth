import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ClipboardList,
  Copy,
  Edit,
  Keyboard,
  Key,
  Laptop,
  Lock,
  Palette,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback, type CSSProperties } from "react";
import { Surface } from "@/features/design-system";
import { cn } from "@/lib/utils";
import { sharedTypedApi, queryKeys } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isApiClientError } from "@/lib/api/errors";
import { SHORTCUT_DEFINITIONS } from "@/features/command-palette";
import type { ReceiptPreference, UiPreferences, LayoutPreferences } from "@/features/preferences";
import {
  MAILBOX_POLICY_TEMPLATES,
  buildCustomMailboxPolicyTemplate,
  findMailboxPolicyTemplate,
  mailboxPolicyTemplateMatchesPolicy,
  savedCustomTemplateToPolicy,
  templateToPolicy,
  type MailboxPolicyTemplateId,
  type MailboxPolicyTemplate,
  type SavedMailboxPolicyTemplate,
} from "@/features/settings/mailbox-policy-templates";
import type { MailboxPolicy, MailboxPolicyWrite } from "@/lib/api/types";
import { AuditLog } from "@/features/audit-log";
import { ChangelogPanel, useChangelog } from "@/features/changelog";
import { ExternalWalletSettings } from "@/features/settings/external-wallet-linking";
import { ManagedWalletStatus } from "@/features/settings/ManagedWalletStatus";
import { RecoveryCodesSection } from "@/features/settings/recovery-codes";

const tabs = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "layout", label: "Layout", icon: Laptop },
  { id: "inbox", label: "Inbox control", icon: ShieldCheck },
  { id: "receipts", label: "Read receipts", icon: CheckCheck },
  { id: "security", label: "Security", icon: Lock },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "audit", label: "Audit log", icon: ClipboardList },
  { id: "changelog", label: "What's new", icon: ScrollText },
] as const;

type Tab = (typeof tabs)[number]["id"];

export function SettingsModal({
  open,
  onClose,
  onCancel,
  preferences,
  onChange,
  layout,
  onLayoutChange,
  onResetLayout,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onCancel?: () => void;
  preferences: UiPreferences;
  onChange: (preferences: UiPreferences) => void;
  layout: LayoutPreferences;
  onLayoutChange: (layout: LayoutPreferences) => void;
  onResetLayout: () => void;
  onSave: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const { hasUnread } = useChangelog();
  const panelRef = useRef<HTMLDivElement>(null);
  const dismiss = onCancel ?? onClose;
  const prefersReducedMotion = useReducedMotion();
  const panelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 30 };

  // Keyboard + focus management for the dialog: close on Escape, focus the
  // panel on open, keep Tab focus inside it, and restore focus on close.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    panel?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, dismiss]);

  const onTabListKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const ids = tabs.map((t) => t.id);
    const current = ids.indexOf(activeTab);
    let next = current;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (current + 1) % ids.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft")
      next = (current - 1 + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    else return;
    e.preventDefault();
    setActiveTab(ids[next]);
    document.getElementById(`settings-tab-${ids[next]}`)?.focus();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={panelTransition}
            className={cn(
              "glass-strong fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl transition-all outline-none",
              activeTab === "audit" || activeTab === "changelog"
                ? "w-[min(800px,calc(100vw-2rem))]"
                : "w-[min(680px,calc(100vw-2rem))]",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <h2 id="settings-title" className="text-sm font-semibold text-foreground">
                Settings
              </h2>
              <button
                onClick={dismiss}
                aria-label="Close settings"
                className="glow-ring rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground active:scale-95"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div
              className={cn(
                "flex",
                activeTab === "audit" || activeTab === "changelog" ? "h-[520px]" : "min-h-[400px]",
              )}
            >
              {/* Sidebar tabs */}
              <div className="w-48 border-r border-white/5 p-3">
                <nav
                  role="tablist"
                  aria-orientation="vertical"
                  aria-label="Settings sections"
                  onKeyDown={onTabListKeyDown}
                  className="space-y-1"
                >
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    const hasUnread = false; // Stubbed to prevent TS error, since it's not present in this scope.
                    return (
                      <button
                        key={tab.id}
                        id={`settings-tab-${tab.id}`}
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`settings-panel-${tab.id}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "glow-ring flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition active:scale-[0.98]",
                          isActive
                            ? "bg-white/[0.08] text-foreground"
                            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1 text-left">{tab.label}</span>
                        {tab.id === "changelog" && hasUnread && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Content */}
              <div
                role="tabpanel"
                id={`settings-panel-${activeTab}`}
                aria-labelledby={`settings-tab-${activeTab}`}
                tabIndex={0}
                className="glow-ring flex-1 p-5 max-h-[450px] overflow-y-auto"
              >
                {activeTab === "account" && <AccountSettings />}
                {activeTab === "appearance" && (
                  <AppearanceSettings preferences={preferences} onChange={onChange} />
                )}
                {activeTab === "notifications" && (
                  <NotificationSettings preferences={preferences} onChange={onChange} />
                )}
                {activeTab === "layout" && (
                  <LayoutSettings
                    layout={layout}
                    onChange={onLayoutChange}
                    onReset={onResetLayout}
                  />
                )}
                {activeTab === "inbox" && <InboxSettings open={open} />}
                {activeTab === "receipts" && (
                  <ReceiptSettings preferences={preferences} onChange={onChange} />
                )}
                {activeTab === "security" && <SecuritySettings />}
                {activeTab === "shortcuts" && <ShortcutSettings />}
                {activeTab === "audit" && <AuditLog />}
                {activeTab === "changelog" && <ChangelogPanel />}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
              <span className="text-[11px] text-muted-foreground">
                Manual edits apply to the draft immediately. Template changes preview before you
                apply. Save or cancel to keep or discard.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onCancel ?? onClose}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onSave();
                    onClose();
                  }}
                  className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none"
                >
                  Save changes
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function AccountSettings() {
  const queryClient = useQueryClient();
  const {
    data: profileData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.account.profile,
    queryFn: ({ signal }) => sharedTypedApi.account.getProfile(signal),
  });

  const mutation = useMutation({
    mutationFn: (updates: { [key: string]: any; version: number }) =>
      sharedTypedApi.account.updateProfile(updates),
    onSuccess: () => {
      // Invalidate both profile and account info queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.account.profile });
      queryClient.invalidateQueries({ queryKey: queryKeys.account.info });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div>
          <div className="h-4 w-16 bg-white/10 rounded mb-2" />
          <div className="h-3 w-40 bg-white/5 rounded" />
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-white/10" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-3 w-32 bg-white/5 rounded" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-white/5 rounded-lg border border-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !profileData) {
    const isAuthError = isApiClientError(error) && error.status === 401;
    return (
      <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
          <div>
            <p className="font-medium text-rose-300">Could not load profile</p>
            <p className="mt-1 opacity-80">
              {isAuthError
                ? "Your session has expired. Please sign in again."
                : "There was a problem loading your account settings. Please try again later."}
            </p>
            {!isAuthError && (
              <button
                onClick={() => refetch()}
                className="mt-3 rounded border border-rose-500/30 bg-rose-500/20 px-3 py-1.5 text-xs font-medium hover:bg-rose-500/30 transition"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { profile, account } = profileData;
  const version = new Date(profile.updatedAt).getTime();

  const handleSave = async (field: string, value: string) => {
    try {
      await mutation.mutateAsync({ [field]: value, version });
    } catch (err) {
      if (isApiClientError(err) && err.status === 409) {
        // Optimistic concurrency conflict
        throw new Error("Conflict");
      }
      if (isApiClientError(err) && err.status === 403) {
        // Recent auth required
        throw new Error("RecentAuth");
      }
      throw err; // Field-level error handled by SettingsField
    }
  };

  return (
    <div className="space-y-6">
      {mutation.isError && isApiClientError(mutation.error) && mutation.error.status === 409 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="text-amber-200">
            <p className="font-medium">Profile updated elsewhere</p>
            <p className="mt-0.5 text-xs opacity-80">
              These settings were modified from another session or tab.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-2"
            >
              Reload latest changes
            </button>
          </div>
        </div>
      )}

      {mutation.isError && isApiClientError(mutation.error) && mutation.error.status === 403 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm flex items-start gap-3">
          <Lock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="text-amber-200">
            <p className="font-medium">Authentication required</p>
            <p className="mt-0.5 text-xs opacity-80">
              For your security, please sign out and sign back in to make this change.
            </p>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-foreground">Profile</h3>
        <p className="mt-1 text-xs text-muted-foreground">Manage your account details</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-2">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="h-16 w-16 rounded-full object-cover border border-white/10"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#4d5560] to-[#232326] flex items-center justify-center border border-white/5">
              <span className="text-lg font-medium text-white/90">
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">{profile.displayName}</p>
            <p className="text-xs text-muted-foreground">{account.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <SettingsField
            label="Display name"
            value={profile.displayName}
            onSave={(val) => handleSave("displayName", val)}
            editable
          />
          <SettingsField
            label="Username"
            value={`@${profile.username}`}
            immutable
            tooltip="Usernames cannot be changed"
          />
          <SettingsField
            label="Bio"
            value={profile.bio ?? ""}
            onSave={(val) => handleSave("bio", val)}
            editable
            placeholder="Tell us a little about yourself"
          />
          <SettingsField
            label="Locale"
            value={profile.locale ?? "en"}
            onSave={(val) => handleSave("locale", val)}
            editable
            placeholder="e.g. en-US"
          />
          <SettingsField
            label="Timezone"
            value={profile.timezone ?? "UTC"}
            onSave={(val) => handleSave("timezone", val)}
            editable
            placeholder="e.g. America/Los_Angeles"
          />
        </div>
      </div>

      <div className="pt-2">
        <h3 className="text-sm font-medium text-foreground mb-3">Identifiers</h3>
        <div className="space-y-3">
          <SettingsField
            label="Email address"
            value={account.email}
            immutable
            tooltip="Email changes require identity verification (not yet available)"
          />
          <SettingsField label="Stellar address" value={account.address} immutable copyable />
          <div className="pt-2">
            <SegmentedSetting
              label="Stellar address display"
              value={profile.addressDisplay ?? "truncated"}
              options={[
                ["truncated", "Truncated (G...4A)"],
                ["full", "Full address"],
              ]}
              onSelect={(val) => handleSave("addressDisplay", val)}
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-white/5 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
          <Check className="w-3 h-3" />
          {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-muted-foreground border border-white/5">
          {account.network}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs text-muted-foreground border border-white/5">
          Member since {new Date(account.createdAt).toLocaleDateString()}
        </span>
      </div>

      {account.betaLimitations.length > 0 && (
        <div className="mt-6 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-4">
          <h4 className="text-xs font-medium text-indigo-300 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Beta Limitations
          </h4>
          <ul className="list-disc pl-4 space-y-1">
            {account.betaLimitations.map((limitation, i) => (
              <li key={i} className="text-[11px] text-indigo-200/80">
                {limitation}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-4">
        <ManagedWalletStatus />
      </div>
    </div>
  );
}

function AppearanceSettings({
  preferences,
  onChange,
}: {
  preferences: UiPreferences;
  onChange: (preferences: UiPreferences) => void;
}) {
  const setDensity = (density: UiPreferences["density"]) =>
    onChange({ ...preferences, density, compactMode: density === "compact" });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Appearance</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Preview theme, density, glass, reader type, and motion before saving.
        </p>
      </div>

      <AppearancePreview preferences={preferences} />

      <div className="space-y-5">
        <SegmentedSetting
          label="Theme"
          value={preferences.theme}
          options={[
            ["dark", "Dark"],
            ["light", "Light"],
            ["system", "System"],
          ]}
          onSelect={(theme) => onChange({ ...preferences, theme: theme as UiPreferences["theme"] })}
        />

        <SegmentedSetting
          label="Density"
          value={preferences.density ?? (preferences.compactMode ? "compact" : "comfortable")}
          options={[
            ["comfortable", "Comfortable"],
            ["compact", "Compact"],
          ]}
          onSelect={(density) => setDensity(density as UiPreferences["density"])}
        />

        <SegmentedSetting
          label="Glass intensity"
          value={preferences.glassIntensity ?? "medium"}
          options={[
            ["subtle", "Subtle"],
            ["medium", "Medium"],
            ["strong", "Strong"],
          ]}
          onSelect={(glassIntensity) =>
            onChange({
              ...preferences,
              glassIntensity: glassIntensity as UiPreferences["glassIntensity"],
            })
          }
        />

        <SegmentedSetting
          label="Reader typography"
          value={preferences.readerTypography ?? "sans"}
          options={[
            ["sans", "Sans"],
            ["serif", "Serif"],
            ["large", "Large"],
          ]}
          onSelect={(readerTypography) =>
            onChange({
              ...preferences,
              readerTypography: readerTypography as UiPreferences["readerTypography"],
            })
          }
        />

        <SettingsToggle
          label="Lower motion"
          description="Reduce app transitions in addition to OS reduced-motion settings. OS reduced-motion is always respected."
          checked={preferences.lowerMotion}
          onChange={(checked) => onChange({ ...preferences, lowerMotion: checked })}
        />

        <SettingsToggle
          label="Show avatars"
          description="Display sender avatars"
          checked={preferences.showAvatars}
          onChange={(checked) => onChange({ ...preferences, showAvatars: checked })}
        />
      </div>
    </div>
  );
}

function SegmentedSetting({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onSelect: (value: string) => void;
}) {
  const groupId = `seg-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = options.findIndex(([v]) => v === value);
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (idx - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onSelect(options[next][0]);
    const radios = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios[next]?.focus();
  };

  return (
    <div>
      <span id={groupId} className="text-xs text-muted-foreground">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={groupId}
        onKeyDown={onKeyDown}
        className="mt-2 flex flex-wrap gap-2"
      >
        {options.map(([optionValue, optionLabel]) => {
          const checked = value === optionValue;
          return (
            <button
              key={optionValue}
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => onSelect(optionValue)}
              className={cn(
                "glow-ring rounded-lg border px-4 py-2 text-xs transition active:scale-[0.97]",
                checked
                  ? "border-white/20 bg-white/[0.08] text-foreground shadow-[var(--shadow-glow)]"
                  : "border-white/5 text-muted-foreground hover:border-white/10 hover:text-foreground",
              )}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AppearancePreview({ preferences }: { preferences: UiPreferences }) {
  const density = preferences.density ?? (preferences.compactMode ? "compact" : "comfortable");
  const previewStyle = {
    "--preview-gap": density === "compact" ? "0.25rem" : "0.5rem",
    "--preview-pad": density === "compact" ? "0.45rem" : "0.7rem",
  } as CSSProperties;

  return (
    <Surface
      variant={preferences.glassIntensity === "strong" ? "strong" : "glass"}
      padding="md"
      className="space-y-3 border border-white/10"
      style={previewStyle}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Live preview</span>
        <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
          Updates instantly
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-[var(--preview-gap)]">
          {["Design review", "Calendar digest", "Ledger receipt"].map((subject, index) => (
            <div
              key={subject}
              className={cn(
                "rounded-xl border border-white/10 bg-white/[0.04] p-[var(--preview-pad)]",
                index === 0 && "bg-emerald-300/[0.08]",
              )}
            >
              <div className="flex items-center justify-between text-[11px] text-foreground">
                <span>{subject}</span>
                <span className="text-muted-foreground">{index + 1}m</span>
              </div>
              <p className="mt-1 truncate text-[10px] text-muted-foreground">
                Preview of a message row across mail surfaces.
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/10 bg-background/25 p-3">
          <p className="text-[11px] font-semibold text-foreground">Reader sample</p>
          <p
            className={cn(
              "mt-2 text-xs leading-relaxed text-muted-foreground",
              preferences.readerTypography === "serif" && "font-serif",
              preferences.readerTypography === "large" && "text-sm leading-7",
            )}
          >
            Your secure digest uses the selected reader typography while mail, calendar, and modal
            surfaces share the same design tokens.
          </p>
          <button className="mt-3 rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition hover:opacity-90">
            CTA preview
          </button>
        </div>
      </div>
    </Surface>
  );
}

function NotificationSettings({
  preferences,
  onChange,
}: {
  preferences: UiPreferences;
  onChange: (preferences: UiPreferences) => void;
}) {
  const queryClient = useQueryClient();
  const {
    data: profileData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.account.profile,
    queryFn: ({ signal }) => sharedTypedApi.account.getProfile(signal),
  });

  const mutation = useMutation({
    mutationFn: (updates: { [key: string]: any; version: number }) =>
      sharedTypedApi.account.updateProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.account.profile });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-4 w-24 bg-white/10 rounded mb-2" />
        <div className="space-y-4 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !profileData) {
    const isAuthError = isApiClientError(error) && error.status === 401;
    return (
      <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
          <div>
            <p className="font-medium text-rose-300">Could not load notifications</p>
            <p className="mt-1 opacity-80">
              {isAuthError
                ? "Your session has expired. Please sign in again."
                : "There was a problem loading your settings. Please try again."}
            </p>
            {!isAuthError && (
              <button
                onClick={() => refetch()}
                className="mt-3 rounded border border-rose-500/30 bg-rose-500/20 px-3 py-1.5 text-xs font-medium hover:bg-rose-500/30 transition"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { profile } = profileData;
  const version = new Date(profile.updatedAt).getTime();
  const notifications = profile.notifications ?? { email: true, desktop: true, sound: false };

  const handleToggle = async (field: keyof typeof notifications, value: boolean) => {
    try {
      await mutation.mutateAsync({
        notifications: { ...notifications, [field]: value },
        version,
      });
    } catch (err) {
      // Errors handled by UI components below
    }
  };

  return (
    <div className="space-y-6">
      {mutation.isError && isApiClientError(mutation.error) && mutation.error.status === 409 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="text-amber-200">
            <p className="font-medium">Settings updated elsewhere</p>
            <p className="mt-0.5 text-xs opacity-80">
              These settings were modified from another session or tab.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-2"
            >
              Reload latest changes
            </button>
          </div>
        </div>
      )}

      {mutation.isError && isApiClientError(mutation.error) && mutation.error.status === 403 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm flex items-start gap-3">
          <Lock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="text-amber-200">
            <p className="font-medium">Authentication required</p>
            <p className="mt-0.5 text-xs opacity-80">
              For your security, please sign out and sign back in to make this change.
            </p>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-foreground">Notifications</h3>
        <p className="mt-1 text-xs text-muted-foreground">Configure how you receive alerts</p>
      </div>
      <div className="space-y-4">
        <SettingsToggle
          label="Email notifications"
          description="Receive email for new messages"
          checked={notifications.email}
          onChange={(checked) => handleToggle("email", checked)}
        />
        <SettingsToggle
          label="Desktop notifications"
          description="Show browser notifications"
          checked={notifications.desktop}
          onChange={(checked) => handleToggle("desktop", checked)}
        />
        <SettingsToggle
          label="Sound"
          description="Play a sound for new messages"
          checked={notifications.sound}
          onChange={(checked) => handleToggle("sound", checked)}
        />
      </div>
    </div>
  );
}

function InboxSettings({ open }: { open: boolean }) {
  const queryClient = useQueryClient();

  const { data: profileData } = useQuery({
    queryKey: queryKeys.account.profile,
    queryFn: ({ signal }) => sharedTypedApi.account.getProfile(signal),
  });

  const address = profileData?.account.address;

  const {
    data: reconciliation,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: address ? queryKeys.policies.reconciliation(address) : [],
    queryFn: ({ signal }) => sharedTypedApi.policies.getReconciliation(address!, undefined, signal),
    enabled: !!address && open,
  });

  const mutation = useMutation({
    mutationFn: (updates: { policy: MailboxPolicyWrite }) =>
      sharedTypedApi.policies.update(address!, updates.policy),
    onSuccess: () => {
      if (address) {
        queryClient.invalidateQueries({ queryKey: queryKeys.policies.reconciliation(address) });
        queryClient.invalidateQueries({ queryKey: queryKeys.policies.policy(address) });
      }
    },
  });

  // Default to a safe baseline if we can't load the policy yet
  const livePolicy = reconciliation?.offchain.policy ?? {
    allowUnknown: true,
    requireVerified: false,
    minimumPostage: "0.0001",
  };

  const [previewTemplateId, setPreviewTemplateId] = useState<MailboxPolicyTemplateId | "custom">(
    () => findMailboxPolicyTemplate(livePolicy)?.id ?? "custom",
  );
  const [savedCustomTemplate, setSavedCustomTemplate] = useState<SavedMailboxPolicyTemplate | null>(
    null,
  );
  const [draftPolicy, setDraftPolicy] = useState<MailboxPolicy>(livePolicy);

  // Sync draft with remote when remote loads/changes
  useEffect(() => {
    if (reconciliation?.offchain.policy) {
      setDraftPolicy(reconciliation.offchain.policy);
      setPreviewTemplateId(
        findMailboxPolicyTemplate(reconciliation.offchain.policy)?.id ?? "custom",
      );
    }
  }, [reconciliation?.offchain.policy]);

  const liveTemplate = useMemo(() => findMailboxPolicyTemplate(draftPolicy), [draftPolicy]);

  const selectedPreview = useMemo(
    () =>
      previewTemplateId === "custom"
        ? (savedCustomTemplate ??
          buildCustomMailboxPolicyTemplate(draftPolicy, liveTemplate?.id ?? null))
        : (MAILBOX_POLICY_TEMPLATES.find((template) => template.id === previewTemplateId) ?? null),
    [previewTemplateId, savedCustomTemplate, draftPolicy, liveTemplate?.id],
  );

  const selectedPolicy = useMemo(
    () =>
      previewTemplateId === "custom"
        ? savedCustomTemplate
          ? savedCustomTemplate.policy
          : draftPolicy
        : selectedPreview
          ? selectedPreview.policy
          : draftPolicy,
    [previewTemplateId, savedCustomTemplate, draftPolicy, selectedPreview],
  );

  const previewMatchesCurrent = useMemo(
    () =>
      previewTemplateId === "custom"
        ? savedCustomTemplate
          ? savedCustomTemplate.policy.allowUnknown === livePolicy.allowUnknown &&
            savedCustomTemplate.policy.requireVerified === livePolicy.requireVerified &&
            savedCustomTemplate.policy.minimumPostage === livePolicy.minimumPostage
          : draftPolicy.allowUnknown === livePolicy.allowUnknown &&
            draftPolicy.requireVerified === livePolicy.requireVerified &&
            draftPolicy.minimumPostage === livePolicy.minimumPostage
        : selectedPreview
          ? mailboxPolicyTemplateMatchesPolicy(selectedPreview as MailboxPolicyTemplate, livePolicy)
          : false,
    [previewTemplateId, savedCustomTemplate, livePolicy, selectedPreview, draftPolicy],
  );

  const applyingWillReplaceCurrent = useMemo(
    () =>
      previewTemplateId === "custom"
        ? !!savedCustomTemplate && !previewMatchesCurrent
        : !previewMatchesCurrent,
    [previewTemplateId, savedCustomTemplate, previewMatchesCurrent],
  );

  const handleTemplateChange = (id: MailboxPolicyTemplateId | "custom") => {
    setPreviewTemplateId(id);
  };

  const handleApply = useCallback(async () => {
    if (!selectedPreview || !address) return;

    let policyToApply: MailboxPolicy;
    if (previewTemplateId === "custom") {
      if (!savedCustomTemplate) {
        setSavedCustomTemplate(
          buildCustomMailboxPolicyTemplate(draftPolicy, liveTemplate?.id ?? null),
        );
        return;
      }
      policyToApply = savedCustomTemplate.policy;
    } else {
      policyToApply = (selectedPreview as MailboxPolicyTemplate).policy;
    }

    try {
      await mutation.mutateAsync({
        policy: {
          ...policyToApply,
          version: reconciliation?.offchain.version ?? undefined,
        },
      });
      setDraftPolicy(policyToApply);
    } catch (err) {
      // Errors handled by UI state
    }
  }, [
    selectedPreview,
    previewTemplateId,
    savedCustomTemplate,
    draftPolicy,
    liveTemplate?.id,
    address,
    mutation,
    reconciliation?.offchain.version,
  ]);

  const handleSaveCustom = useCallback(() => {
    setSavedCustomTemplate(buildCustomMailboxPolicyTemplate(draftPolicy, liveTemplate?.id ?? null));
    setPreviewTemplateId("custom");
  }, [draftPolicy, liveTemplate?.id]);

  const updateDraftPolicy = useCallback((updates: Partial<MailboxPolicy>) => {
    setDraftPolicy((prev) => {
      const next = { ...prev, ...updates };
      setPreviewTemplateId("custom");
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground animate-pulse">
        Loading policy settings...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
        Could not load policy.{" "}
        <button onClick={() => refetch()} className="underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mutation.isError && isApiClientError(mutation.error) && mutation.error.status === 409 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="text-amber-200">
            <p className="font-medium">Policy updated elsewhere</p>
            <p className="mt-0.5 text-xs opacity-80">
              These settings were modified from another session or tab.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-2"
            >
              Reload latest changes
            </button>
          </div>
        </div>
      )}

      {reconciliation?.state === "pending_write" && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm flex items-start gap-3">
          <RefreshCw className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5 animate-spin" />
          <div className="text-emerald-200">
            <p className="font-medium">Changes pending on chain</p>
            <p className="mt-0.5 text-xs opacity-80">Your policy is confirming on the network.</p>
          </div>
        </div>
      )}

      {reconciliation?.state === "failed" && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="text-rose-200">
            <p className="font-medium">Policy write failed</p>
            <p className="mt-0.5 text-xs opacity-80">
              {reconciliation.offchain.intentError || "An error occurred writing to the network."}
            </p>
            <button
              onClick={() =>
                mutation.mutate({
                  policy: { ...livePolicy, version: reconciliation.offchain.version ?? undefined },
                })
              }
              className="mt-2 text-xs font-medium text-rose-300 hover:text-rose-200 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-foreground">Inbox control</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose how unknown senders reach you, or preview a common inbox policy template.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground">Template gallery</p>
              <p className="text-[11px] text-muted-foreground">
                Select a template to preview its tradeoffs and sender experience. Apply when ready.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {MAILBOX_POLICY_TEMPLATES.map((template) => {
              const selected = previewTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateChange(template.id)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-emerald-400",
                    selected
                      ? "border-emerald-300/30 bg-emerald-300/[0.08] shadow-[0_0_0_1px_rgba(110,231,183,0.12)]"
                      : "border-white/10 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{template.label}</p>
                      <p className="text-[11px] text-muted-foreground">{template.summary}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        selected
                          ? "bg-emerald-400/20 text-emerald-300"
                          : "bg-white/[0.06] text-muted-foreground",
                      )}
                    >
                      {selected ? "Previewing" : "View"}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-xl border border-white/5 bg-black/15 px-3 py-2">
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Tradeoff
                      </span>
                      <span className="mt-1 block text-foreground">{template.tradeoff}</span>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/15 px-3 py-2">
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Sender experience
                      </span>
                      <span className="mt-1 block text-foreground">
                        {template.senderExperience}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handleTemplateChange("custom")}
              aria-pressed={previewTemplateId === "custom"}
              className={cn(
                "rounded-2xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-sky-400 outline-none",
                previewTemplateId === "custom"
                  ? "border-sky-300/30 bg-sky-300/[0.08] shadow-[0_0_0_1px_rgba(103,232,249,0.12)]"
                  : "border-dashed border-white/10 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {savedCustomTemplate?.label ?? "Custom draft"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {savedCustomTemplate?.summary ??
                      "Tune the policy fields below, then save as custom to lock in a reusable draft."}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    previewTemplateId === "custom"
                      ? "bg-sky-400/20 text-sky-300"
                      : "bg-white/[0.06] text-muted-foreground",
                  )}
                >
                  {savedCustomTemplate ? "Saved" : "Unsaved"}
                </span>
              </div>
              {savedCustomTemplate ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-[11px] text-muted-foreground">
                  <div className="rounded-xl border border-white/5 bg-black/15 px-3 py-2">
                    <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Source
                    </span>
                    <span className="mt-1 block text-foreground">
                      {savedCustomTemplate.sourceTemplateId ?? "Manual draft"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/15 px-3 py-2">
                    <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Exact values
                    </span>
                    <span className="mt-1 block text-foreground">
                      {selectedPolicy.allowUnknown === false
                        ? "Allowlist only"
                        : selectedPolicy.requireVerified
                          ? "Verified only"
                          : "Request approval"}
                      {" | "}
                      {selectedPolicy.minimumPostage} XLM
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-[11px] text-muted-foreground">
                  Adjust the policy fields below, then click{" "}
                  <span className="font-medium text-foreground">Save as custom</span> to store this
                  draft.
                </div>
              )}
            </button>
          </div>
        </div>

        <Surface variant="strong" padding="md" className="space-y-4 border border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Policy preview
              </p>
              <h4 className="mt-1 text-sm font-semibold text-foreground">
                {previewTemplateId === "custom"
                  ? "Custom draft"
                  : (selectedPreview?.label ?? "Mailbox policy")}
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">{selectedPreview?.summary}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                previewTemplateId === "custom"
                  ? "bg-sky-400/15 text-sky-300"
                  : "bg-emerald-400/15 text-emerald-300",
              )}
            >
              {previewTemplateId === "custom" ? "Custom" : "Template"}
            </span>
          </div>

          <div className="grid gap-3">
            <PreviewStat
              label="Unknown sender handling"
              value={
                selectedPolicy.allowUnknown === false
                  ? "Allowlist only"
                  : selectedPolicy.requireVerified
                    ? "Verified only"
                    : "Request approval"
              }
              meta={
                previewTemplateId === "custom"
                  ? "Reflects the current live policy values."
                  : "Matches the selected template before apply."
              }
            />
            <PreviewStat
              label="Minimum postage"
              value={`${selectedPolicy.minimumPostage} XLM`}
              meta={
                previewTemplateId === "custom"
                  ? "Current draft postage value."
                  : "Template postage used when applied."
              }
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Sender experience
            </p>
            <p className="mt-1 text-sm text-foreground">{selectedPreview?.senderExperience}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Tradeoff
            </p>
            <p className="mt-1 text-sm text-foreground">{selectedPreview?.tradeoff}</p>
          </div>

          {applyingWillReplaceCurrent && (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-3 flex items-start gap-2">
              <AlertTriangle
                className="h-4 w-4 text-amber-300 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-amber-200">
                  Applying will overwrite your current draft
                </p>
                <p className="mt-1 text-xs text-amber-100/70">
                  Your live draft stays unchanged until you click Apply. This action replaces the
                  current unsaved policy values.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {previewTemplateId === "custom" && !savedCustomTemplate ? (
              <button
                type="button"
                onClick={handleSaveCustom}
                aria-label="Save current policy values as a custom template"
                className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none"
              >
                Save as custom
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApply}
                disabled={previewMatchesCurrent || mutation.isPending}
                aria-label={
                  previewMatchesCurrent
                    ? "Template already applied"
                    : previewTemplateId === "custom"
                      ? "Apply custom template to live draft"
                      : "Apply selected template to live draft"
                }
                className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none disabled:opacity-40 disabled:pointer-events-none"
              >
                {mutation.isPending
                  ? "Applying..."
                  : previewMatchesCurrent
                    ? "Already applied"
                    : previewTemplateId === "custom"
                      ? "Apply custom template"
                      : "Apply template"}
              </button>
            )}
          </div>
        </Surface>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-foreground">Policy editor</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Manual edits update the live draft immediately. Template selections are previewed first
            — click Apply to load a template's values here.
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
            Unknown sender handling
          </p>
          <div className="grid gap-2">
            {[
              {
                value: { allowUnknown: true, requireVerified: false },
                label: "Request approval",
                description: "Hold unknown senders in a review queue. You approve individually.",
              },
              {
                value: { allowUnknown: true, requireVerified: true },
                label: "Verified only",
                description: "Require cryptographic identity verification before admission.",
              },
              {
                value: { allowUnknown: false, requireVerified: false },
                label: "Trusted contacts only",
                description: "Reject every unknown sender. Only your allowlist gets through.",
              },
            ].map((policy) => {
              const isActive =
                draftPolicy.allowUnknown === policy.value.allowUnknown &&
                draftPolicy.requireVerified === policy.value.requireVerified;
              return (
                <button
                  key={policy.label}
                  onClick={() => updateDraftPolicy(policy.value)}
                  aria-pressed={isActive}
                  className={cn(
                    "rounded-xl border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none active:scale-[0.99]",
                    isActive
                      ? "border-emerald-200/20 bg-emerald-200/[0.06]"
                      : "border-white/10 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="block text-sm font-medium text-foreground">
                      {policy.label}
                    </span>
                    {isActive && (
                      <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {policy.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <PostageInput
          value={draftPolicy.minimumPostage}
          onChange={(v) => updateDraftPolicy({ minimumPostage: v })}
        />
      </div>
    </div>
  );
}

function PreviewStat({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2.5">
      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block text-sm font-medium text-foreground">{value}</span>
      <span className="mt-1 block text-[11px] text-muted-foreground">{meta}</span>
    </div>
  );
}

function ReceiptSettings({
  preferences,
  onChange,
}: {
  preferences: UiPreferences;
  onChange: (preferences: UiPreferences) => void;
}) {
  const setReceipt = (type: keyof UiPreferences["receipts"], value: ReceiptPreference) => {
    onChange({
      ...preferences,
      receipts: {
        ...preferences.receipts,
        [type]: value,
      },
    });
  };

  const receiptOptions: {
    value: ReceiptPreference;
    label: string;
    description: string;
  }[] = [
    {
      value: "auto",
      label: "Automatic",
      description: "Send read receipt as soon as you open the message.",
    },
    {
      value: "manual",
      label: "Manual",
      description: "Ask before sending a read receipt.",
    },
    {
      value: "never",
      label: "Never",
      description: "Never send read receipts for this sender type.",
    },
  ];

  const senderTypes = [
    {
      key: "trusted" as const,
      label: "Trusted contacts",
      help: "Senders you've approved or added.",
    },
    {
      key: "unknown" as const,
      label: "Unknown senders",
      help: "Senders who haven't been verified or approved.",
    },
    {
      key: "paid" as const,
      label: "Paid requests",
      help: "Senders who paid postage to reach you.",
    },
    {
      key: "organizations" as const,
      label: "Organizations",
      help: "Verified organizations and businesses.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Read receipt settings</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Control when read receipts are sent. You decide what senders see.
        </p>
      </div>
      <div className="space-y-4">
        {senderTypes.map((type) => (
          <div key={type.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{type.label}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{type.help}</p>
            <div className="mt-2 flex gap-2">
              {receiptOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setReceipt(type.key, opt.value)}
                  aria-pressed={preferences.receipts[type.key] === opt.value}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-emerald-400",
                    preferences.receipts[type.key] === opt.value
                      ? "border-emerald-200/20 bg-emerald-200/[0.06]"
                      : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
                  )}
                >
                  <div className="text-[11px] font-medium text-foreground">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShortcutSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Keyboard Shortcuts</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          The shortcut overlay opened with <span className="font-mono">?</span> is the canonical
          reference. Shortcuts pause while you are typing in text fields.
        </p>
      </div>
      <div className="space-y-2">
        {SHORTCUT_DEFINITIONS.map((shortcut) => (
          <div
            key={shortcut.id}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
          >
            <div>
              <span className="text-sm text-foreground">{shortcut.label}</span>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{shortcut.description}</div>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {shortcut.keys.map((key) => (
                <kbd
                  key={`${shortcut.id}-${key}`}
                  className="rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsField({
  label,
  value,
  editable,
  immutable,
  copyable,
  tooltip,
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  editable?: boolean;
  immutable?: boolean;
  copyable?: boolean;
  tooltip?: string;
  placeholder?: string;
  onSave?: (value: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleEdit = () => {
    if (immutable) return;
    setEditValue(value);
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  };

  const handleSave = async () => {
    if (editValue.trim() === value.trim()) {
      setIsEditing(false);
      return;
    }

    if (onSave) {
      setIsSaving(true);
      setError(null);
      try {
        await onSave(editValue);
        setIsEditing(false);
      } catch (err: unknown) {
        if (err instanceof Error && (err.message === "Conflict" || err.message === "RecentAuth")) {
          // Surfaced at the component level
          setIsEditing(false);
        } else if (isApiClientError(err) && err.details && typeof err.details === "object") {
          // Extract field-level validation error
          const fieldErrors = Object.values(err.details).flat();
          if (fieldErrors.length > 0) {
            setError(String(fieldErrors[0]));
          } else {
            setError(err.message);
          }
        } else {
          setError("Failed to save changes. Please try again.");
        }
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            {immutable && (
              <Lock
                className="w-3 h-3 text-muted-foreground/60"
                aria-label={tooltip || "Immutable"}
              />
            )}
          </div>

          {isEditing ? (
            <div className="mt-1.5 space-y-2">
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                placeholder={placeholder}
                className={cn(
                  "w-full rounded-md border bg-black/20 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors",
                  error ? "border-rose-500/50" : "border-white/10",
                )}
              />
              {error && <p className="text-[11px] text-rose-400">{error}</p>}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="rounded px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p
              className={cn(
                "mt-1 text-sm text-foreground",
                !value && placeholder && "text-muted-foreground/50 italic",
              )}
            >
              {value || placeholder || "Not set"}
            </p>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {copyable && (
              <button
                onClick={handleCopy}
                aria-label={`Copy ${label}`}
                className="rounded p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            )}
            {editable && (
              <button
                onClick={handleEdit}
                aria-label={`Edit ${label}`}
                className="rounded p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SecuritySettings() {
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");

  const sessions = [
    {
      id: "1",
      device: "Current session - MacBook Air",
      location: "San Francisco, CA",
      lastActive: "Just now",
      isCurrent: true,
    },
    {
      id: "2",
      device: "iPhone 15 Pro",
      location: "San Francisco, CA",
      lastActive: "2 hours ago",
      isCurrent: false,
    },
  ];

  const devices = [
    {
      id: "1",
      name: "MacBook Air",
      type: "Desktop",
      lastActive: "Just now",
      trusted: true,
    },
    {
      id: "2",
      name: "iPhone 15 Pro",
      type: "Mobile",
      lastActive: "2 hours ago",
      trusted: true,
    },
  ];

  const handleCopyKey = () => {
    navigator.clipboard.writeText("GDQJMSGKJGQ2X576L33OY4JFDZ7NJG5OJ3LJ44V33PUPU7D5Q5X4KJ");
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-foreground">Security</h3>
        <p className="mt-1 text-xs text-muted-foreground">Manage sessions, devices, and recovery</p>
      </div>

      {/* External Wallet Linking */}
      <ExternalWalletSettings />

      {/* Active Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Active sessions</p>
            <p className="text-xs text-muted-foreground">
              Sessions currently signed in to your account
            </p>
          </div>
          <button
            onClick={() =>
              setConfirmDialog({
                title: "Revoke all sessions?",
                description: "This will revoke all active sessions across all devices.",
                onConfirm: async () => {
                  try {
                    await sharedTypedApi.auth.logoutAll();
                  } catch {
                    // Fallthrough safely
                  }
                  setConfirmDialog(null);
                },
              })
            }
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"
          >
            Revoke all sessions
          </button>
        </div>
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3"
            >
              <div className="flex items-center gap-3">
                <Laptop className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-foreground">{session.device}</p>
                    {session.isCurrent && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {session.location} • {session.lastActive}
                  </p>
                </div>
              </div>
              {!session.isCurrent && (
                <button
                  onClick={() =>
                    setConfirmDialog({
                      title: "Revoke session?",
                      description: "This will sign out this device from your account.",
                      onConfirm: async () => {
                        try {
                          await sharedTypedApi.auth.logout();
                        } catch {
                          // Fallthrough safely
                        }
                        setConfirmDialog(null);
                      },
                    })
                  }
                  className="rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Trusted Devices */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Trusted devices</p>
            <p className="text-xs text-muted-foreground">
              Devices that can access your account without extra verification
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3"
            >
              <div className="flex items-center gap-3">
                <Laptop className="h-4 w-4 text-muted-foreground" />
                {editingDevice === device.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-foreground outline-none focus:border-white/20"
                    />
                    <button
                      onClick={() => setEditingDevice(null)}
                      className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-foreground">{device.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.type} • {device.lastActive}
                    </p>
                  </div>
                )}
              </div>
              {!editingDevice && (
                <button
                  onClick={() => {
                    setDeviceName(device.name);
                    setEditingDevice(device.id);
                  }}
                  aria-label={`Edit ${device.name}`}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recovery */}
      <RecoveryCodesSection />

      {/* Keys */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Signing keys</p>
            <p className="text-xs text-muted-foreground">Your public key for verifying messages</p>
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <code className="text-[10px] text-muted-foreground truncate">
              GDQJMSGKJGQ2X576L33OY4JFDZ7NJG5OJ3LJ44V33PUPU7D5Q5X4KJ
            </code>
            <button
              onClick={handleCopyKey}
              className="ml-2 flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-white/[0.06] transition"
            >
              {copiedKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedKey ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={() =>
              setConfirmDialog({
                title: "Rotate keys?",
                description:
                  "This will generate a new key pair. You'll need to update your recovery info.",
                onConfirm: () => setConfirmDialog(null),
              })
            }
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-amber-400 hover:bg-amber-500/10 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Rotate keys (roadmap)
          </button>
        </div>
      </div>

      {/* High-risk actions (roadmap) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">High-risk actions</p>
            <p className="text-xs text-muted-foreground">
              Extra confirmation for sensitive operations
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 opacity-50 pointer-events-none">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Coming soon</span>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-sm rounded-2xl p-5 space-y-4">
            <h4 className="text-sm font-medium text-foreground">{confirmDialog.title}</h4>
            <p className="text-xs text-muted-foreground">{confirmDialog.description}</p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-xs text-foreground hover:bg-white/[0.06] transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600 transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function LayoutSettings({
  layout,
  onChange,
  onReset,
}: {
  layout: LayoutPreferences;
  onChange: (layout: LayoutPreferences) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Layout</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Customize your mailbox layout and panel sizes.
        </p>
      </div>

      <div className="space-y-4">
        <SettingsToggle
          label="Compact mode"
          description="A denser layout for the email list and message views."
          checked={layout.compactMode}
          onChange={(checked) => onChange({ ...layout, compactMode: checked })}
        />

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Reset layout</p>
              <p className="text-xs text-muted-foreground">
                Restore all panel widths and collapse states to default.
              </p>
            </div>
            <button
              onClick={onReset}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-white/[0.06]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const slugId = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground" id={`toggle-label-${slugId}`}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5" id={`toggle-desc-${slugId}`}>
          {description}
        </p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        aria-labelledby={`toggle-label-${slugId}`}
        aria-describedby={`toggle-desc-${slugId}`}
        className={cn(
          "glow-ring relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "hover:brightness-110 active:scale-95",
          checked ? "bg-emerald-500" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full shadow-sm transition-[left] duration-200",
            checked ? "left-6 bg-white" : "left-1 bg-white/80",
          )}
        />
      </button>
    </div>
  );
}

function PostageInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [focused, setFocused] = useState(false);
  const isInvalid = value !== "" && (isNaN(parseFloat(value)) || parseFloat(value) < 0);

  return (
    <div>
      <label htmlFor="settings-postage-input">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Minimum postage
        </span>
      </label>
      <div
        className={cn(
          "mt-2 flex items-center rounded-lg border bg-white/[0.04] px-3 transition-colors",
          isInvalid
            ? "border-rose-400/50 ring-1 ring-rose-400/30"
            : focused
              ? "border-emerald-400/50 ring-1 ring-emerald-400/20"
              : "border-white/10 hover:border-white/20",
        )}
      >
        <input
          id="settings-postage-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="decimal"
          placeholder="0.01"
          aria-label="Minimum postage in XLM"
          aria-invalid={isInvalid}
          aria-describedby="settings-postage-hint"
          className="w-full bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
        />
        <span className="text-xs text-muted-foreground shrink-0" aria-hidden="true">
          XLM
        </span>
      </div>
      {isInvalid ? (
        <p id="settings-postage-hint" className="mt-1.5 text-[11px] text-rose-400">
          Enter a valid number ≥ 0, for example 0.01.
        </p>
      ) : (
        <p id="settings-postage-hint" className="mt-1.5 text-[11px] text-muted-foreground">
          Amount senders must attach. Set to 0 to accept without a deposit.
        </p>
      )}
    </div>
  );
}
