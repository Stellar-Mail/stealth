import { describe, it, expect, beforeEach } from "vitest";
import { VerificationTelemetryService } from "../../../src/server/api/verification-telemetry";

describe("BETA-005: Verification Telemetry Service", () => {
  let telemetry: VerificationTelemetryService;

  beforeEach(() => {
    telemetry = new VerificationTelemetryService();
  });

  it("accurately aggregates token lifecycles and success rates", () => {
    telemetry.recordTokenIssued();
    telemetry.recordTokenIssued();
    telemetry.recordTokenVerified(15000);
    telemetry.recordTokenExpired();
    telemetry.recordTokenReused();
    telemetry.recordBruteForceBlocked();
    telemetry.recordResendCooldownBlocked();
    telemetry.recordDeliverySuccess();
    telemetry.recordDeliverySuccess();
    telemetry.recordDeliveryFailure();

    const snap = telemetry.getSnapshot();
    expect(snap.tokensIssuedTotal).toBe(2);
    expect(snap.tokensVerifiedTotal).toBe(1);
    expect(snap.tokensExpiredTotal).toBe(1);
    expect(snap.tokensReusedTotal).toBe(1);
    expect(snap.tokensBruteForceBlockedTotal).toBe(1);
    expect(snap.tokenResendCooldownBlockedTotal).toBe(1);
    expect(snap.deliveriesSucceededTotal).toBe(2);
    expect(snap.deliveriesFailedTotal).toBe(1);
    expect(snap.deliverySuccessRatePercentage).toBe(66.67);
    expect(snap.averageVerificationDurationSeconds).toBe(15);
  });

  it("detects operational alert triggers", () => {
    for (let i = 0; i < 12; i++) {
      telemetry.recordBruteForceBlocked();
    }

    const alerts = telemetry.evaluateAlertRules();
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0]).toContain("CRITICAL");
    expect(alerts[0]).toContain("Abnormal surge in brute force token validation attempts");
  });

  it("exports Prometheus standard metric format", () => {
    telemetry.recordTokenIssued();
    telemetry.recordTokenVerified(5000);

    const prom = telemetry.toPrometheusFormat();
    expect(prom).toContain("stealth_auth_tokens_issued_total 1");
    expect(prom).toContain("stealth_auth_tokens_verified_total 1");
    expect(prom).toContain("# TYPE stealth_auth_tokens_issued_total counter");
  });
});
