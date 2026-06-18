export type EventCategory =
  | "onboarding"
  | "policy"
  | "send_outcome"
  | "request"
  | "proof_failure"
  | "retention";

export type EventPurpose = "activation_measurement" | "reliability_monitoring" | "abuse_prevention";

export interface AnalyticsEvent {
  id: string;
  category: EventCategory;
  purpose: EventPurpose;
  timestamp: number;
  // Privacy budget cost (e.g., epsilon value) consumed by this event
  privacyBudget: number;
  // How long this event is retained (in days)
  retentionDays: number;
  // Minimal payload, strictly forbidding plaintext bodies, subjects, keys, or correspondents
  payload: Record<string, string | number | boolean>;
}

export interface AnalyticsConfig {
  enabled: boolean;
  maxPrivacyBudget: number;
}

export class PrivacyAnalytics {
  private config: AnalyticsConfig;
  private currentBudget: number = 0;
  private events: AnalyticsEvent[] = [];

  constructor(config: AnalyticsConfig = { enabled: false, maxPrivacyBudget: 10.0 }) {
    this.config = config;
  }

  public setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
  }

  public inspectEvents(): AnalyticsEvent[] {
    return this.events;
  }

  public clearEvents() {
    this.events = [];
    this.currentBudget = 0;
  }

  public enforceRetention() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    this.events = this.events.filter((event) => {
      const ageDays = (now - event.timestamp) / dayMs;
      return ageDays <= event.retentionDays;
    });
  }

  public track(event: Omit<AnalyticsEvent, "id" | "timestamp">) {
    if (!this.config.enabled) {
      return;
    }

    // Verify no forbidden fields exist in payload
    const forbiddenKeys = ["body", "subject", "key", "correspondent", "email", "plaintext"];
    for (const key of Object.keys(event.payload)) {
      if (forbiddenKeys.some((forbidden) => key.toLowerCase().includes(forbidden))) {
        throw new Error(`Analytics event payload contains forbidden key: ${key}`);
      }
    }

    if (this.currentBudget + event.privacyBudget > this.config.maxPrivacyBudget) {
      console.warn("Privacy budget exceeded, dropping event");
      return;
    }

    this.currentBudget += event.privacyBudget;
    this.events.push({
      ...event,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });
  }
}

export const analytics = new PrivacyAnalytics();
