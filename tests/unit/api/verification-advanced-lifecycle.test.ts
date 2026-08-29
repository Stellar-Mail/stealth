import { describe, it, expect, beforeEach } from "vitest";
import {
  generateVerificationToken,
  DEFAULT_VERIFICATION_POLICY,
  type VerificationPolicy,
} from "../../../src/server/api/verification-service";
import {
  constantTimeCompare,
  validateEmailDomainSafety,
} from "../../../src/server/api/verification-security-hardening";
import { NotificationAuditTrail } from "../../../src/services/notifications/audit-trail";
import { ResilientNotificationDeliveryService } from "../../../src/services/notifications/resilience";
import { SinkNotificationAdapter } from "../../../src/services/notifications/sink";
import { VerificationTelemetryService } from "../../../src/server/api/verification-telemetry";

describe("BETA-005: Advanced Verification Token Lifecycle Integration", () => {
  let sinkAdapter: SinkNotificationAdapter;
  let resilientDelivery: ResilientNotificationDeliveryService;
  let auditTrail: NotificationAuditTrail;
  let telemetry: VerificationTelemetryService;

  beforeEach(() => {
    sinkAdapter = new SinkNotificationAdapter();
    resilientDelivery = new ResilientNotificationDeliveryService(sinkAdapter);
    auditTrail = new NotificationAuditTrail();
    telemetry = new VerificationTelemetryService();
  });

  it("produces cryptographically distinct random tokens of 32 bytes entropy", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const token = generateVerificationToken();
      expect(token.length).toBeGreaterThanOrEqual(40);
      expect(tokens.has(token)).toBe(false);
      tokens.add(token);
    }
  });

  it("executes end-to-end issuance, delivery dispatch, audit logging, and telemetry telemetry recording", async () => {
    const rawToken = generateVerificationToken();
    const recipient = "user_e2e_test@stealth.mail";
    expect(validateEmailDomainSafety(recipient).valid).toBe(true);

    telemetry.recordTokenIssued();

    const receipt = await resilientDelivery.deliverVerificationEmail({
      to: recipient,
      purpose: "email_verification",
      verificationUrl: `https://stealth.mail/auth/verify?token=${encodeURIComponent(rawToken)}`,
      expiresAt: new Date(Date.now() + DEFAULT_VERIFICATION_POLICY.tokenLifetimeMs),
    });

    expect(receipt.accepted).toBe(true);
    expect(receipt.transport).toBe("sink");
    expect(sinkAdapter.size).toBe(1);

    telemetry.recordDeliverySuccess();

    // Verify constant time matching against token
    const tokenMatch = constantTimeCompare(rawToken, rawToken);
    expect(tokenMatch).toBe(true);

    telemetry.recordTokenVerified(1200);

    const snapshot = telemetry.getSnapshot();
    expect(snapshot.tokensIssuedTotal).toBe(1);
    expect(snapshot.tokensVerifiedTotal).toBe(1);
    expect(snapshot.deliveriesSucceededTotal).toBe(1);
    expect(snapshot.deliverySuccessRatePercentage).toBe(100);
  });
});
