import type { UiPreferences } from "@/features/preferences/types";
import { defaultCriticalAlerts } from "@/features/preferences/types";

export function CriticalWarningSettings({
  preferences,
  onChange,
}: {
  preferences: UiPreferences;
  onChange: (preferences: UiPreferences) => void;
}) {
  const alerts = preferences.criticalAlerts ?? defaultCriticalAlerts;
  return (
    <section className="mb-7 border-b border-border pb-6" aria-labelledby="critical-warnings-title">
      <h3 id="critical-warnings-title" className="text-sm font-medium text-foreground">
        Critical mail warnings
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Keep mail quiet by default. Choose when to show a flag. Message verification and
        unsafe-content blocking always remain active.
      </p>
      <div className="mt-4 space-y-4">
        {[
          { key: "enabled" as const, label: "Show critical mail warnings" },
          { key: "unknownSenders" as const, label: "Flag senders who are not verified or allowed" },
          { key: "failedVerification" as const, label: "Flag failed message verification" },
        ].map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center justify-between gap-4 text-xs text-foreground"
          >
            <span>{label}</span>
            <input
              type="checkbox"
              role="switch"
              aria-label={label}
              checked={alerts[key]}
              disabled={key !== "enabled" && !alerts.enabled}
              onChange={(event) =>
                onChange({
                  ...preferences,
                  criticalAlerts: { ...alerts, [key]: event.target.checked },
                })
              }
              className="h-4 w-4 accent-primary"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
