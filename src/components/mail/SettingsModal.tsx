import { motion, AnimatePresence } from "framer-motion";
import { X, User, Palette, Bell, Keyboard, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { UiPreferences } from "@/features/preferences";

const tabs = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "inbox", label: "Inbox control", icon: ShieldCheck },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
] as const;

type Tab = (typeof tabs)[number]["id"];

export function SettingsModal({
  open,
  onClose,
  preferences,
  onChange,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  preferences: UiPreferences;
  onChange: (preferences: UiPreferences) => void;
  onSave: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("account");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="glass-strong fixed left-1/2 top-1/2 z-50 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Settings</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-[400px]">
              {/* Sidebar tabs */}
              <div className="w-48 border-r border-white/5 p-3">
                <nav className="space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                          isActive
                            ? "bg-white/[0.08] text-foreground"
                            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Content */}
              <div className="flex-1 p-5">
                {activeTab === "account" && <AccountSettings />}
                {activeTab === "appearance" && (
                  <AppearanceSettings preferences={preferences} onChange={onChange} />
                )}
                {activeTab === "notifications" && (
                  <NotificationSettings preferences={preferences} onChange={onChange} />
                )}
                {activeTab === "inbox" && (
                  <InboxSettings preferences={preferences} onChange={onChange} />
                )}
                {activeTab === "shortcuts" && <ShortcutSettings />}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
              <span className="text-[11px] text-muted-foreground">
                Preferences are stored on this device.
              </span>
              <button
                onClick={() => {
                  onSave();
                  onClose();
                }}
                className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90"
              >
                Save changes
              </button>
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
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Appearance</h3>
        <p className="mt-1 text-xs text-muted-foreground">Customize the look and feel</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground">Theme</label>
          <div className="mt-2 flex gap-2">
            {["dark", "light", "system"].map((t) => (
              <button
                key={t}
                onClick={() => onChange({ ...preferences, theme: t as UiPreferences["theme"] })}
                className={cn(
                  "rounded-lg border px-4 py-2 text-xs capitalize transition",
                  preferences.theme === t
                    ? "border-white/20 bg-white/[0.08] text-foreground"
                    : "border-white/5 text-muted-foreground hover:border-white/10",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <SettingsToggle
          label="Compact mode"
          description="Reduce spacing in the email list"
          checked={preferences.compactMode}
          onChange={(checked) => onChange({ ...preferences, compactMode: checked })}
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
  preferences,
  onChange,
}: {
  preferences: UiPreferences;
  onChange: (preferences: UiPreferences) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Inbox control</h3>
        <p className="mt-1 text-xs text-muted-foreground">Choose how unknown senders reach you.</p>
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
            onClick={() =>
              onChange({
                ...preferences,
                unknownSenders: policy.value as UiPreferences["unknownSenders"],
              })
            }
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
            onChange={(event) => onChange({ ...preferences, minimumPostage: event.target.value })}
            inputMode="decimal"
            className="w-full bg-transparent py-2 text-sm text-foreground outline-none"
          />
          <span className="text-xs text-muted-foreground">XLM</span>
        </div>
      </label>
    </div>
  );
}

function ShortcutSettings() {
  const shortcuts = [
    { key: "⌘N", action: "Compose new email" },
    { key: "⌘K", action: "Open command palette" },
    { key: "E", action: "Archive thread" },
    { key: "G I", action: "Go to Inbox" },
    { key: "G S", action: "Go to Starred" },
    { key: "G T", action: "Go to Sent" },
    { key: "Esc", action: "Close modal" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Keyboard Shortcuts</h3>
        <p className="mt-1 text-xs text-muted-foreground">Quick actions for power users</p>
      </div>
      <div className="space-y-2">
        {shortcuts.map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
          >
            <span className="text-sm text-foreground">{s.action}</span>
            <kbd className="rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {s.key}
            </kbd>
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
        onClick={() => setChecked(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full transition",
          checked ? "bg-white/20" : "bg-white/10"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-foreground transition",
            checked ? "left-6" : "left-1"
          )}
        />
      </button>
    </div>
  );
}
