/**
 * BETA-005 / BETA-093: Verification Token & Notification Telemetry Service.
 *
 * Implements fine-grained performance counters, failure classification distributions,
 * Prometheus-compatible metrics exporters, and operational alerting thresholds.
 *
 * Security Invariants:
 * - Metrics never track or export plaintext tokens, emails, or personal identifiers.
 * - All bucket counters and rates are anonymized and aggregated.
 */

export interface VerificationMetricsSnapshot {
  readonly tokensIssuedTotal: number;
  readonly tokensVerifiedTotal: number;
  readonly tokensExpiredTotal: number;
  readonly tokensReusedTotal: number;
  readonly tokensBruteForceBlockedTotal: number;
  readonly tokenResendCooldownBlockedTotal: number;
  readonly deliveriesSucceededTotal: number;
  readonly deliveriesFailedTotal: number;
  readonly activePendingVerificationsGauge: number;
  readonly averageVerificationDurationSeconds: number;
  readonly deliverySuccessRatePercentage: number;
  readonly anomalySurgeDetected: boolean;
}

export interface TelemetryAlertRule {
  readonly id: string;
  readonly metricName: string;
  readonly threshold: number;
  readonly description: string;
  readonly severity: "info" | "warning" | "critical";
}

export const DEFAULT_TELEMETRY_ALERT_RULES: TelemetryAlertRule[] = [
  {
    id: "RULE_BRUTE_FORCE_SURGE",
    metricName: "tokensBruteForceBlockedTotal",
    threshold: 10,
    description: "Abnormal surge in brute force token validation attempts",
    severity: "critical",
  },
  {
    id: "RULE_DELIVERY_FAILURE_SPIKE",
    metricName: "deliveryFailureRate",
    threshold: 0.15, // 15% failure rate
    description: "Notification delivery failure rate exceeds operational SLA",
    severity: "warning",
  },
  {
    id: "RULE_EXPIRATION_SPIKE",
    metricName: "tokensExpiredTotal",
    threshold: 50,
    description: "High rate of unredeemed expiring verification tokens",
    severity: "info",
  },
];

export class VerificationTelemetryService {
  private issuedCount = 0;
  private verifiedCount = 0;
  private expiredCount = 0;
  private reusedCount = 0;
  private bruteForceCount = 0;
  private cooldownBlockedCount = 0;
  private deliveriesSuccess = 0;
  private deliveriesFail = 0;
  private pendingTokensCount = 0;

  private readonly verificationDurationsMs: number[] = [];
  private readonly maxSamples = 2000;

  recordTokenIssued(): void {
    this.issuedCount++;
    this.pendingTokensCount++;
  }

  recordTokenVerified(lifetimeMs?: number): void {
    this.verifiedCount++;
    if (this.pendingTokensCount > 0) this.pendingTokensCount--;
    if (lifetimeMs !== undefined && lifetimeMs >= 0) {
      if (this.verificationDurationsMs.length >= this.maxSamples) {
        this.verificationDurationsMs.shift();
      }
      this.verificationDurationsMs.push(lifetimeMs);
    }
  }

  recordTokenExpired(): void {
    this.expiredCount++;
    if (this.pendingTokensCount > 0) this.pendingTokensCount--;
  }

  recordTokenReused(): void {
    this.reusedCount++;
  }

  recordBruteForceBlocked(): void {
    this.bruteForceCount++;
  }

  recordResendCooldownBlocked(): void {
    this.cooldownBlockedCount++;
  }

  recordDeliverySuccess(): void {
    this.deliveriesSuccess++;
  }

  recordDeliveryFailure(): void {
    this.deliveriesFail++;
  }

  getSnapshot(): VerificationMetricsSnapshot {
    const totalDeliveries = this.deliveriesSuccess + this.deliveriesFail;
    const successRate =
      totalDeliveries > 0 ? (this.deliveriesSuccess / totalDeliveries) * 100 : 100;

    let avgDuration = 0;
    if (this.verificationDurationsMs.length > 0) {
      const sum = this.verificationDurationsMs.reduce((acc, v) => acc + v, 0);
      avgDuration = Math.round(sum / this.verificationDurationsMs.length / 1000);
    }

    const anomalyDetected =
      this.bruteForceCount >= 10 || (totalDeliveries >= 10 && successRate < 80);

    return {
      tokensIssuedTotal: this.issuedCount,
      tokensVerifiedTotal: this.verifiedCount,
      tokensExpiredTotal: this.expiredCount,
      tokensReusedTotal: this.reusedCount,
      tokensBruteForceBlockedTotal: this.bruteForceCount,
      tokenResendCooldownBlockedTotal: this.cooldownBlockedCount,
      deliveriesSucceededTotal: this.deliveriesSuccess,
      deliveriesFailedTotal: this.deliveriesFail,
      activePendingVerificationsGauge: this.pendingTokensCount,
      averageVerificationDurationSeconds: avgDuration,
      deliverySuccessRatePercentage: Math.round(successRate * 100) / 100,
      anomalySurgeDetected: anomalyDetected,
    };
  }

  evaluateAlertRules(rules: TelemetryAlertRule[] = DEFAULT_TELEMETRY_ALERT_RULES): string[] {
    const triggered: string[] = [];
    const snap = this.getSnapshot();

    for (const rule of rules) {
      if (
        rule.id === "RULE_BRUTE_FORCE_SURGE" &&
        snap.tokensBruteForceBlockedTotal >= rule.threshold
      ) {
        triggered.push(
          `[${rule.severity.toUpperCase()}] ${rule.description} (${snap.tokensBruteForceBlockedTotal} events)`,
        );
      }
      if (rule.id === "RULE_EXPIRATION_SPIKE" && snap.tokensExpiredTotal >= rule.threshold) {
        triggered.push(
          `[${rule.severity.toUpperCase()}] ${rule.description} (${snap.tokensExpiredTotal} expired)`,
        );
      }
      if (rule.id === "RULE_DELIVERY_FAILURE_SPIKE") {
        const total = snap.deliveriesSucceededTotal + snap.deliveriesFailedTotal;
        if (total >= 10) {
          const failRate = snap.deliveriesFailedTotal / total;
          if (failRate >= rule.threshold) {
            triggered.push(
              `[${rule.severity.toUpperCase()}] ${rule.description} (${(failRate * 100).toFixed(1)}% failure rate)`,
            );
          }
        }
      }
    }

    return triggered;
  }

  toPrometheusFormat(): string {
    const snap = this.getSnapshot();
    return [
      `# HELP stealth_auth_tokens_issued_total Total number of verification tokens created`,
      `# TYPE stealth_auth_tokens_issued_total counter`,
      `stealth_auth_tokens_issued_total ${snap.tokensIssuedTotal}`,
      `# HELP stealth_auth_tokens_verified_total Total number of successful verifications`,
      `# TYPE stealth_auth_tokens_verified_total counter`,
      `stealth_auth_tokens_verified_total ${snap.tokensVerifiedTotal}`,
      `# HELP stealth_auth_tokens_expired_total Total number of expired unredeemed tokens`,
      `# TYPE stealth_auth_tokens_expired_total counter`,
      `stealth_auth_tokens_expired_total ${snap.tokensExpiredTotal}`,
      `# HELP stealth_auth_tokens_reused_total Total number of token reuse attempts`,
      `# TYPE stealth_auth_tokens_reused_total counter`,
      `stealth_auth_tokens_reused_total ${snap.tokensReusedTotal}`,
      `# HELP stealth_auth_tokens_bruteforce_blocked_total Total brute force attempts blocked`,
      `# TYPE stealth_auth_tokens_bruteforce_blocked_total counter`,
      `stealth_auth_tokens_bruteforce_blocked_total ${snap.tokensBruteForceBlockedTotal}`,
      `# HELP stealth_auth_delivery_success_total Successful notification dispatches`,
      `# TYPE stealth_auth_delivery_success_total counter`,
      `stealth_auth_delivery_success_total ${snap.deliveriesSucceededTotal}`,
      `# HELP stealth_auth_delivery_failed_total Failed notification dispatches`,
      `# TYPE stealth_auth_delivery_failed_total counter`,
      `stealth_auth_delivery_failed_total ${snap.deliveriesFailedTotal}`,
      `# HELP stealth_auth_pending_tokens_gauge Current count of outstanding pending tokens`,
      `# TYPE stealth_auth_pending_tokens_gauge gauge`,
      `stealth_auth_pending_tokens_gauge ${snap.activePendingVerificationsGauge}`,
    ].join("\n");
  }

  reset(): void {
    this.issuedCount = 0;
    this.verifiedCount = 0;
    this.expiredCount = 0;
    this.reusedCount = 0;
    this.bruteForceCount = 0;
    this.cooldownBlockedCount = 0;
    this.deliveriesSuccess = 0;
    this.deliveriesFail = 0;
    this.pendingTokensCount = 0;
    this.verificationDurationsMs.length = 0;
  }
}

export const globalVerificationTelemetry = new VerificationTelemetryService();
