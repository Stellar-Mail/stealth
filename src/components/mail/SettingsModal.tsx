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
  Smartphone,
  Trash2,
  User,
  X,
  ShieldAlert,
  AlertCircle,
  RotateCw,
  Info,
  LogOut,
  Plus,
  Fingerprint,
  Contact,
  HardDrive,
  Download,
} from "lucide-react";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { toast } from "sonner";
import { Surface } from "@/features/design-system";
import { cn } from "@/lib/utils";
import { SHORTCUT_DEFINITIONS } from "@/features/command-palette";
import type { ReceiptPreference, UiPreferences, LayoutPreferences } from "@/features/preferences";
import {
  MAILBOX_POLICY_TEMPLATES,
  buildCustomMailboxPolicyTemplate,
  findMailboxPolicyTemplate,
  mailboxPolicyTemplateMatchesPreferences,
  savedCustomTemplateToPreferences,
  templateToPreferences,
  type MailboxPolicyTemplateId,
  type MailboxPolicyTemplate,
  type SavedMailboxPolicyTemplate,
} from "@/features/settings/mailbox-policy-templates";
import { AuditLog } from "@/features/audit-log";
import { ChangelogPanel } from "@/features/changelog";
import { useChangelog } from "@/features/changelog/useChangelog";
import { useDevices } from "@/features/device-management/useDevices";
import type { Device, KeyStatus, RecoveryMethod } from "@/features/device-management/types";

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
        (el: HTMLElement) => el.offsetParent !== null,
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

  const onTabListKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
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
                <X className="h-4 w-4" />
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
                <div
                  role="tablist"
                  aria-orientation="vertical"
                  aria-label="Settings sections"
                  tabIndex={0}
                  onKeyDown={onTabListKeyDown}
                  className="space-y-1"
                >
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
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
                </div>
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
                {activeTab === "inbox" && (
                  <InboxSettings open={open} preferences={preferences} onChange={onChange} />
                )}
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
                Manual edits apply immediately. Template selections preview before apply. Save to
                keep changes or cancel to restore.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onCancel ?? onClose}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onSave();
                    onClose();
                  }}
                  className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 active:scale-[0.98]"
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
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Profile</h3>
        <p className="mt-1 text-xs text-muted-foreground">Manage your account details</p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#4d5560] to-[#232326] flex items-center justify-center">
            <span className="text-lg font-medium text-white/90">EN</span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Eve Navarro</p>
            <p className="text-xs text-muted-foreground">eve@aether.app</p>
          </div>
        </div>
        <div className="space-y-3">
          <SettingsField label="Display name" value="Eve Navarro" />
          <SettingsField label="Email" value="eve@aether.app" />
          <SettingsField label="Stellar address" value="GDQ...X4KJ" />
        </div>
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
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
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
        tabIndex={0}
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
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Notifications</h3>
        <p className="mt-1 text-xs text-muted-foreground">Configure how you receive alerts</p>
      </div>
      <div className="space-y-4">
        <SettingsToggle
          label="Email notifications"
          description="Receive email for new messages"
          checked={preferences.emailNotifications}
          onChange={(checked) => onChange({ ...preferences, emailNotifications: checked })}
        />
        <SettingsToggle
          label="Desktop notifications"
          description="Show browser notifications"
          checked={preferences.desktopNotifications}
          onChange={(checked) => onChange({ ...preferences, desktopNotifications: checked })}
        />
        <SettingsToggle
          label="Sound"
          description="Play a sound for new messages"
          checked={preferences.sound}
          onChange={(checked) => onChange({ ...preferences, sound: checked })}
        />
      </div>
    </div>
  );
}

function InboxSettings({
  open,
  preferences,
  onChange,
}: {
  open: boolean;
  preferences: UiPreferences;
  onChange: (preferences: UiPreferences) => void;
}) {
  const [previewTemplateId, setPreviewTemplateId] = useState<MailboxPolicyTemplateId | "custom">(
    () => findMailboxPolicyTemplate(preferences)?.id ?? "custom",
  );
  const [savedCustomTemplate, setSavedCustomTemplate] = useState<SavedMailboxPolicyTemplate | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setPreviewTemplateId(findMailboxPolicyTemplate(preferences)?.id ?? "custom");
  }, [open, preferences]);

  const currentDraft = {
    unknownSenders: preferences.unknownSenders,
    minimumPostage: preferences.minimumPostage,
  } as const;

  const liveTemplate = findMailboxPolicyTemplate(currentDraft);

  const selectedPreview =
    previewTemplateId === "custom"
      ? (savedCustomTemplate ??
        buildCustomMailboxPolicyTemplate(currentDraft, liveTemplate?.id ?? null))
      : (MAILBOX_POLICY_TEMPLATES.find((template) => template.id === previewTemplateId) ?? null);

  const selectedPreferences =
    previewTemplateId === "custom"
      ? savedCustomTemplate
        ? savedCustomTemplateToPreferences(savedCustomTemplate)
        : currentDraft
      : selectedPreview
        ? templateToPreferences(selectedPreview as MailboxPolicyTemplate)
        : currentDraft;

  const previewMatchesCurrent =
    previewTemplateId === "custom"
      ? savedCustomTemplate
        ? savedCustomTemplate.policy.unknownSenders === preferences.unknownSenders &&
          savedCustomTemplate.policy.minimumPostage === preferences.minimumPostage
        : true
      : selectedPreview
        ? mailboxPolicyTemplateMatchesPreferences(
            selectedPreview as MailboxPolicyTemplate,
            currentDraft,
          )
        : false;

  const applyingWillReplaceCurrent =
    previewTemplateId === "custom"
      ? !!savedCustomTemplate && !previewMatchesCurrent
      : !previewMatchesCurrent;

  const handleTemplateChange = (id: MailboxPolicyTemplateId | "custom") => {
    setPreviewTemplateId(id);
  };

  const handleApply = () => {
    if (!selectedPreview) return;

    if (previewTemplateId === "custom") {
      if (!savedCustomTemplate) {
        setSavedCustomTemplate(
          buildCustomMailboxPolicyTemplate(currentDraft, liveTemplate?.id ?? null),
        );
        return;
      }

      onChange({
        ...preferences,
        ...savedCustomTemplateToPreferences(savedCustomTemplate),
      });
      return;
    }

    onChange({
      ...preferences,
      ...templateToPreferences(selectedPreview as MailboxPolicyTemplate),
    });
  };

  const handleSaveCustom = () => {
    setSavedCustomTemplate(
      buildCustomMailboxPolicyTemplate(currentDraft, liveTemplate?.id ?? null),
    );
    setPreviewTemplateId("custom");
  };

  const updateUnknownSenders = (unknownSenders: UiPreferences["unknownSenders"]) => {
    setPreviewTemplateId("custom");
    onChange({
      ...preferences,
      unknownSenders,
    });
  };

  const updateMinimumPostage = (minimumPostage: string) => {
    setPreviewTemplateId("custom");
    onChange({
      ...preferences,
      minimumPostage,
    });
  };

  return (
    <div className="space-y-6">
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
                Comparison cards show each template’s tradeoff and sender experience before you
                apply it.
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
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
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
              className={cn(
                "rounded-2xl border p-4 text-left transition",
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
                      "Your unsaved policy edits stay separate from the built-in templates."}
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
                  {savedCustomTemplate ? "Saved" : "Local"}
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
                      {selectedPreferences.unknownSenders === "request"
                        ? "Request approval"
                        : selectedPreferences.unknownSenders === "verified"
                          ? "Verified only"
                          : "Allowlist only"}
                      {" | "}
                      {selectedPreferences.minimumPostage} XLM
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-[11px] text-muted-foreground">
                  Click Save as custom after you tune the live policy fields.
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
                selectedPreferences.unknownSenders === "request"
                  ? "Request approval"
                  : selectedPreferences.unknownSenders === "verified"
                    ? "Verified only"
                    : "Allowlist only"
              }
              meta={
                previewTemplateId === "custom"
                  ? "Reflects the current live policy values."
                  : "Matches the selected template before apply."
              }
            />
            <PreviewStat
              label="Minimum postage"
              value={`${selectedPreferences.minimumPostage} XLM`}
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
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-3">
              <p className="text-sm font-medium text-amber-200">Explicit overwrite required</p>
              <p className="mt-1 text-xs text-amber-100/80">
                Applying this preview will replace the current unsaved policy draft. Your live draft
                stays unchanged until you click Apply.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {previewTemplateId === "custom" && !savedCustomTemplate ? (
              <button
                type="button"
                onClick={handleSaveCustom}
                className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
              >
                Save as custom
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
              >
                {previewTemplateId === "custom" ? "Apply custom template" : "Apply template"}
              </button>
            )}
          </div>
        </Surface>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-foreground">Policy editor</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Manual edits update the live policy draft. Template selection previews values until you
            apply.
          </p>
        </div>

        <div className="grid gap-2">
          {[
            {
              value: "request",
              label: "Request approval",
              description: "Hold unknown senders for review.",
            },
            {
              value: "verified",
              label: "Verified only",
              description: "Accept verified identities with postage.",
            },
            {
              value: "block",
              label: "Trusted contacts only",
              description: "Reject every unknown sender.",
            },
          ].map((policy) => (
            <button
              key={policy.value}
              onClick={() => updateUnknownSenders(policy.value as UiPreferences["unknownSenders"])}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                preferences.unknownSenders === policy.value
                  ? "border-emerald-200/20 bg-emerald-200/[0.06]"
                  : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
              )}
            >
              <span className="block text-sm font-medium text-foreground">{policy.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{policy.description}</span>
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-xs text-muted-foreground">Minimum postage</span>
          <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3">
            <input
              value={preferences.minimumPostage}
              onChange={(event) => updateMinimumPostage(event.target.value)}
              inputMode="decimal"
              className="w-full bg-transparent py-2 text-sm text-foreground outline-none"
            />
            <span className="text-xs text-muted-foreground">XLM</span>
          </div>
        </label>
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
    { value: "manual", label: "Manual", description: "Ask before sending a read receipt." },
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
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-left transition",
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

function SettingsField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        defaultValue={value}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground focus:border-white/20 focus:outline-none"
      />
    </div>
  );
}

function DeviceIcon({ type }: { type: Device["type"] }) {
  if (type === "mobile") return <Smartphone className="h-4 w-4 text-muted-foreground" />;
  return <Laptop className="h-4 w-4 text-muted-foreground" />;
}

function KeyStatusBadge({ status }: { status: KeyStatus }) {
  const config: Record<KeyStatus, { label: string; className: string }> = {
    active: {
      label: "Active",
      className: "bg-emerald-500/10 text-emerald-400",
    },
    compromised: {
      label: "Compromised",
      className: "bg-red-500/10 text-red-400",
    },
    revoked: {
      label: "Revoked",
      className: "bg-amber-500/10 text-amber-400",
    },
    rotated: {
      label: "Rotated",
      className: "bg-blue-500/10 text-blue-400",
    },
  };
  const c = config[status];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", c.className)}>
      {c.label}
    </span>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

type ConfirmDialogState = {
  title: string;
  description: string;
  type?: "danger" | "warning" | "info";
  onConfirm: () => void;
};

function RecoveryMethodIcon({ type }: { type: RecoveryMethod["type"] }) {
  switch (type) {
    case "trusted_contact":
      return <Contact className="h-3.5 w-3.5" />;
    case "hardware_key":
      return <HardDrive className="h-3.5 w-3.5" />;
    case "paper_key":
      return <Fingerprint className="h-3.5 w-3.5" />;
    case "encrypted_backup":
      return <Download className="h-3.5 w-3.5" />;
  }
}

function RecoveryMethodLabel({ type }: { type: RecoveryMethod["type"] }) {
  switch (type) {
    case "trusted_contact":
      return "Trusted contact";
    case "hardware_key":
      return "Hardware key";
    case "paper_key":
      return "Paper key";
    case "encrypted_backup":
      return "Encrypted backup";
  }
}

function SecuritySettings() {
  const {
    devices,
    loading,
    error,
    recoveryStatus,
    dismissError,
    renameDevice,
    toggleTrust,
    revokeDevice,
    flagCompromised,
    rotateKeys,
    addRecoveryMethod,
    removeRecoveryMethod,
    registerDevice,
  } = useDevices();

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [showRevocationInfo, setShowRevocationInfo] = useState(false);

  const [showAddRecovery, setShowAddRecovery] = useState(false);
  const [recoveryType, setRecoveryType] = useState<RecoveryMethod["type"]>("trusted_contact");
  const [recoveryLabel, setRecoveryLabel] = useState("");
  const [recoveryValue, setRecoveryValue] = useState("");

  const handleCopyKey = useCallback(() => {
    const key =
      devices.find((d) => d.isCurrent)?.publicKey ??
      "GDQJMSGKJGQ2X576L33OY4JFDZ7NJG5OJ3LJ44V33PUPU7D5Q5X4KJ";
    navigator.clipboard.writeText(key).then(() => {
      setCopiedKey(true);
      toast.success("Public key copied");
      setTimeout(() => setCopiedKey(false), 2000);
    });
  }, [devices]);

  const withConfirm = useCallback((action: () => Promise<void>, successMsg: string) => {
    setConfirming(true);
    action()
      .then(() => {
        toast.success(successMsg);
        setConfirmDialog(null);
      })
      .catch((err: Error) => {
        toast.error(err.message ?? "Action failed");
      })
      .finally(() => setConfirming(false));
  }, []);

  const handleSaveDeviceName = useCallback(
    async (deviceId: string) => {
      if (deviceName.trim()) {
        try {
          await renameDevice(deviceId, deviceName.trim());
          toast.success("Device renamed");
          setEditingDevice(null);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to rename");
        }
      }
    },
    [deviceName, renameDevice],
  );

  const handleRevokeDevice = useCallback(
    (device: Device) => {
      setConfirmDialog({
        title: `Revoke "${device.name}"?`,
        description:
          device.keyStatus === "compromised"
            ? "This device is flagged as compromised. All encryption keys will be permanently invalidated. The device will lose all access immediately. This cannot be undone."
            : "All sessions will be terminated and the device will lose access immediately. The device will need to re-authenticate to regain access. This cannot be undone.",
        type: "danger",
        onConfirm: () => withConfirm(() => revokeDevice(device.id), `"${device.name}" revoked`),
      });
    },
    [revokeDevice, withConfirm],
  );

  const handleFlagCompromised = useCallback(
    (device: Device) => {
      setConfirmDialog({
        title: `Flag "${device.name}" as compromised?`,
        description:
          "All sessions will be immediately revoked and encryption keys invalidated. Future messages will not be decryptable by this device. We strongly recommend rotating all account keys after this action. This cannot be undone.",
        type: "danger",
        onConfirm: () =>
          withConfirm(() => flagCompromised(device.id), `"${device.name}" flagged as compromised`),
      });
    },
    [flagCompromised, withConfirm],
  );

  const handleToggleTrust = useCallback(
    (device: Device) => {
      toggleTrust(device.id, !device.trusted)
        .then(() => toast.success(device.trusted ? "Trust removed" : "Device trusted"))
        .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to update trust"));
    },
    [toggleTrust],
  );

  const handleRotateKeys = useCallback(() => {
    const activeDevices = devices.filter((d) => d.keyStatus === "active" && d.isCurrent);
    if (activeDevices.length === 0) {
      toast.error("No active devices to rotate keys for");
      return;
    }
    setConfirmDialog({
      title: "Rotate encryption keys?",
      description:
        "This generates a new key pair for this device. Old keys are marked as rotated. " +
        "Existing encrypted messages remain accessible with old keys until they expire. " +
        "You will need to update recovery information after rotation. This action is logged in your audit history.",
      type: "warning",
      onConfirm: () =>
        withConfirm(async () => {
          const newKey = `GD${Array.from(
            { length: 54 },
            () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)],
          ).join("")}`;
          await rotateKeys(
            activeDevices.map((d) => d.id),
            newKey,
          );
        }, "Keys rotated successfully"),
    });
  }, [devices, rotateKeys, withConfirm]);

  const handleRegisterDevice = useCallback(() => {
    withConfirm(async () => {
      const newKey = `GD${Array.from(
        { length: 54 },
        () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)],
      ).join("")}`;
      await registerDevice(newKey);
    }, "Device registered");
  }, [registerDevice, withConfirm]);

  const handleAddRecoveryMethod = useCallback(async () => {
    if (!recoveryLabel.trim() || !recoveryValue.trim()) {
      toast.error("Label and value are required");
      return;
    }
    try {
      await addRecoveryMethod(recoveryType, recoveryLabel.trim(), recoveryValue.trim());
      toast.success("Recovery method added");
      setShowAddRecovery(false);
      setRecoveryLabel("");
      setRecoveryValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add recovery method");
    }
  }, [addRecoveryMethod, recoveryType, recoveryLabel, recoveryValue]);

  const handleRemoveRecoveryMethod = useCallback(
    (method: RecoveryMethod) => {
      setConfirmDialog({
        title: `Remove "${method.label}"?`,
        description:
          "You will lose this recovery method. Ensure you have at least one other recovery method configured before removing this one.",
        type: "warning",
        onConfirm: () =>
          withConfirm(() => removeRecoveryMethod(method.id), "Recovery method removed"),
      });
    },
    [removeRecoveryMethod, withConfirm],
  );

  const currentDevice = devices.find((d) => d.isCurrent);
  const activeSessions = devices.flatMap((d) =>
    d.sessions.filter(
      (s) => !s.revokedAt && d.keyStatus !== "revoked" && d.keyStatus !== "compromised",
    ),
  );
  const compromisedDevices = devices.filter((d) => d.keyStatus === "compromised");
  const hasRevokedDevices = devices.some((d) => d.keyStatus === "revoked");

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-medium text-foreground">Security</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage devices, sessions, keys, and recovery
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-foreground">Security</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage devices, sessions, keys, and recovery
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={dismissError} className="rounded p-1 text-red-400 hover:bg-red-500/10">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Security alert for compromised devices */}
      {compromisedDevices.length > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-400 animate-pulse" />
            <p className="text-sm font-medium text-red-400">Security alert</p>
          </div>
          <p className="text-xs text-red-300/80">
            {compromisedDevices.length === 1
              ? `${compromisedDevices[0].name} has been flagged as compromised.`
              : `${compromisedDevices.length} devices have been flagged as compromised.`}{" "}
            Access revoked and encryption keys invalidated.{" "}
            <button
              onClick={handleRotateKeys}
              className="underline text-red-300 hover:text-red-200"
            >
              Rotate your account keys
            </button>{" "}
            to secure your account.
          </p>
        </div>
      )}

      {/* Warning for revoked devices */}
      {hasRevokedDevices && compromisedDevices.length === 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300/80">
            Some devices have been revoked. Review your devices below.
          </p>
        </div>
      )}

      {/* Current device banner */}
      {currentDevice && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-emerald-400">{currentDevice.name}</p>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  This device
                </span>
              </div>
              <p className="text-xs text-emerald-300/70 mt-0.5">
                {currentDevice.lastLocation} &bull; Last active{" "}
                {formatRelativeTime(currentDevice.lastActive)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No devices - registration prompt */}
      {devices.length === 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6 text-center space-y-3">
          <Laptop className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <div>
            <p className="text-sm font-medium text-foreground">No devices registered</p>
            <p className="text-xs text-muted-foreground mt-1">
              Register this device to enable encrypted message delivery and manage access.
            </p>
          </div>
          <button
            onClick={handleRegisterDevice}
            className="rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90 transition"
          >
            Register this device
          </button>
        </div>
      )}

      {/* Active Sessions */}
      {devices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Active sessions</p>
              <p className="text-xs text-muted-foreground">
                Sessions currently signed in to your account
              </p>
            </div>
            {activeSessions.length > 0 && (
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-muted-foreground">
                {activeSessions.length} active
              </span>
            )}
          </div>
          <div className="space-y-2">
            {activeSessions.length === 0 ? (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center">
                <p className="text-xs text-muted-foreground">No active sessions</p>
              </div>
            ) : (
              activeSessions.map((session) => {
                const device = devices.find((d) => d.id === session.deviceId);
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <DeviceIcon type={device?.type ?? "unknown"} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-foreground truncate">
                            {device?.name ?? "Unknown device"}
                          </p>
                          {session.isCurrent && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 shrink-0">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {session.location} &bull; {formatRelativeTime(session.lastActiveAt)}
                        </p>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button
                        onClick={() => {
                          const dev = devices.find((d) => d.id === session.deviceId);
                          if (dev) handleRevokeDevice(dev);
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition shrink-0"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Devices list */}
      {devices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Devices</p>
              <p className="text-xs text-muted-foreground">
                Registered devices and their encryption key status
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {devices.map((device) => {
              const isCurrent = device.isCurrent;
              const isDisabled =
                device.keyStatus === "revoked" || device.keyStatus === "compromised";
              return (
                <div
                  key={device.id}
                  className={cn(
                    "rounded-lg border p-3 space-y-2 transition",
                    isCurrent
                      ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                      : isDisabled
                        ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                        : "border-white/5 bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <DeviceIcon type={device.type} />
                      <div className="min-w-0 flex-1">
                        {editingDevice === device.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={deviceName}
                              onChange={(e) => setDeviceName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveDeviceName(device.id);
                                if (e.key === "Escape") setEditingDevice(null);
                              }}
                              className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-foreground outline-none focus:border-white/20 w-40"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveDeviceName(device.id)}
                              className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-foreground truncate">{device.name}</p>
                            {isCurrent && (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 shrink-0">
                                Current
                              </span>
                            )}
                            <KeyStatusBadge status={device.keyStatus} />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {device.lastLocation} &bull; {formatRelativeTime(device.lastActive)}
                          {device.trusted && !isDisabled && (
                            <>
                              {" "}
                              &bull; <span className="text-emerald-400/70">Trusted</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isDisabled && !editingDevice && (
                        <>
                          <button
                            onClick={() => {
                              setDeviceName(device.name);
                              setEditingDevice(device.id);
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition"
                            title="Rename device"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleTrust(device)}
                            className={cn(
                              "rounded-lg p-1.5 transition",
                              device.trusted
                                ? "text-emerald-400 hover:bg-emerald-500/10"
                                : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                            )}
                            title={device.trusted ? "Remove trust" : "Mark as trusted"}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRevokeDevice(device)}
                            className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-500/10 transition"
                            title="Revoke device access"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleFlagCompromised(device)}
                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10 transition"
                            title="Flag as compromised"
                          >
                            <ShieldAlert className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Device info sub-row */}
                  {!isDisabled && !editingDevice && (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                      <span className="truncate font-mono max-w-[120px]">
                        {device.publicKey.slice(0, 20)}...
                      </span>
                      <span>Registered {formatRelativeTime(device.createdAt)}</span>
                      {device.sessions.length > 0 && (
                        <span>
                          {device.sessions.filter((s) => !s.revokedAt).length} active session(s)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Revoked/compromised info */}
                  {isDisabled && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                      <Info className="h-3 w-3" />
                      <span>
                        {device.keyStatus === "compromised"
                          ? "Flagged as compromised. Encryption keys invalidated."
                          : "Access revoked. Device must re-register to regain access."}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revocation consequences info */}
      <div>
        <button
          onClick={() => setShowRevocationInfo(!showRevocationInfo)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <Info className="h-3.5 w-3.5" />
          {showRevocationInfo ? "Hide" : "Show"} revocation details
        </button>
        {showRevocationInfo && (
          <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-2">
            <p className="text-xs font-medium text-foreground">
              What happens when you revoke a device?
            </p>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                <span>All active sessions on that device are immediately terminated</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                <span>
                  The device&apos;s encryption key is invalidated &mdash; it can no longer decrypt
                  new messages
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                <span>
                  Existing encrypted messages already on the device remain accessible locally
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                <span>The device must re-authenticate and re-register to regain access</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                <span>
                  If the device is compromised, flagging it triggers a security alert and
                  invalidates all associated keys
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                <span>All revocation and compromise events are recorded in the audit history</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Recovery methods */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Account recovery</p>
            <p className="text-xs text-muted-foreground">
              Methods to restore access if all devices are lost
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  recoveryStatus.enabled ? "bg-emerald-400" : "bg-amber-400",
                )}
              />
              <p className="text-xs font-medium text-foreground">
                {recoveryStatus.enabled ? "Recovery configured" : "No recovery methods"}
              </p>
            </div>
            {recoveryStatus.lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Last updated {formatRelativeTime(recoveryStatus.lastUpdated)}
              </span>
            )}
          </div>

          {/* Recovery methods list */}
          {recoveryStatus.recoveryMethods && recoveryStatus.recoveryMethods.length > 0 && (
            <div className="space-y-2">
              {recoveryStatus.recoveryMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04]">
                      <RecoveryMethodIcon type={method.type} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-foreground truncate">{method.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        <RecoveryMethodLabel type={method.type} />
                        {method.lastTestedAt && (
                          <> &bull; Last tested {formatRelativeTime(method.lastTestedAt)}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveRecoveryMethod(method)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition shrink-0"
                    title="Remove recovery method"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span>{recoveryStatus.devicesCount} device(s) registered</span>
            <span>{recoveryStatus.trustedCount} trusted</span>
            {recoveryStatus.recoveryMethods && (
              <span>{recoveryStatus.recoveryMethods.length} recovery method(s)</span>
            )}
          </div>

          {/* Add recovery method form */}
          {showAddRecovery ? (
            <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="space-y-2">
                <span className="text-[11px] text-muted-foreground" id="recovery-type-label">
                  Recovery type
                </span>
                <div className="flex gap-2">
                  {(
                    ["trusted_contact", "hardware_key", "paper_key", "encrypted_backup"] as const
                  ).map((t) => (
                    <button
                      key={t}
                      onClick={() => setRecoveryType(t)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition",
                        recoveryType === t
                          ? "bg-white/[0.1] text-foreground"
                          : "text-muted-foreground hover:bg-white/[0.04]",
                      )}
                    >
                      <RecoveryMethodIcon type={t} />
                      <RecoveryMethodLabel type={t} />
                    </button>
                  ))}
                </div>
              </div>
              <input
                value={recoveryLabel}
                onChange={(e) => setRecoveryLabel(e.target.value)}
                placeholder="Label (e.g., My Hardware Key)"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-white/20 focus:outline-none"
              />
              <input
                value={recoveryValue}
                onChange={(e) => setRecoveryValue(e.target.value)}
                placeholder={
                  recoveryType === "trusted_contact"
                    ? "Contact Stellar address"
                    : recoveryType === "hardware_key"
                      ? "Hardware key fingerprint"
                      : recoveryType === "paper_key"
                        ? "Paper key public key"
                        : "Encrypted backup reference"
                }
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-white/20 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddRecoveryMethod}
                  className="flex-1 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90 transition"
                >
                  Add method
                </button>
                <button
                  onClick={() => setShowAddRecovery(false)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-muted-foreground hover:bg-white/[0.06] transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddRecovery(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-foreground hover:bg-white/[0.06] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add recovery method
              </button>
              <button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-foreground hover:bg-white/[0.06] transition">
                Export checklist
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keys */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Encryption keys</p>
            <p className="text-xs text-muted-foreground">
              Current device public key for encrypted message delivery
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="min-w-0 flex-1">
              <code className="text-[10px] text-muted-foreground truncate block">
                {currentDevice?.publicKey ??
                  "GDQJMSGKJGQ2X576L33OY4JFDZ7NJG5OJ3LJ44V33PUPU7D5Q5X4KJ"}
              </code>
            </div>
            <button
              onClick={handleCopyKey}
              className="ml-2 flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-white/[0.06] transition shrink-0"
            >
              {copiedKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedKey ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-400/70 flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Key active
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/60">
              Devices using this key: {devices.filter((d) => d.keyStatus === "active").length}
            </span>
          </div>
          <button
            onClick={handleRotateKeys}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-amber-400 hover:bg-amber-500/10 transition"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Rotate keys
          </button>
        </div>
      </div>

      {/* High-risk actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">High-risk actions</p>
            <p className="text-xs text-muted-foreground">
              Sensitive operations with extra confirmation
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Device revocation, compromise flags, and key rotation require confirmation</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>
              All sensitive actions are recorded in your audit history. Message body content is
              never included in audit events.
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={confirmDialog.title}
        >
          <div className="glass-strong w-full max-w-sm rounded-2xl p-5 space-y-4">
            <h4 className="text-sm font-medium text-foreground">{confirmDialog.title}</h4>
            <p className="text-xs text-muted-foreground">{confirmDialog.description}</p>
            <div className="flex gap-2 pt-2">
              <button
                autoFocus
                disabled={confirming}
                onClick={() => setConfirmDialog(null)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-xs text-foreground hover:bg-white/[0.06] transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                disabled={confirming}
                onClick={confirmDialog.onConfirm}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2 text-xs font-medium text-white transition flex items-center justify-center gap-2 disabled:opacity-60",
                  confirmDialog.type === "danger"
                    ? "bg-red-500 hover:bg-red-600"
                    : confirmDialog.type === "warning"
                      ? "bg-amber-500 hover:bg-amber-600"
                      : "bg-foreground text-background hover:opacity-90",
                )}
              >
                {confirming && (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {confirming ? "Processing..." : "Confirm"}
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
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn(
          "glow-ring relative h-6 w-11 rounded-full transition hover:brightness-125 active:scale-95",
          checked ? "bg-white/20" : "bg-white/10",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-foreground transition",
            checked ? "left-6" : "left-1",
          )}
        />
      </button>
    </div>
  );
}
