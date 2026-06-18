import { describe, expect, it } from "vitest";
import { PRESET_SCENARIOS } from "../fixtures/presets";

describe("demo admin dashboard presets", () => {
  it("defines the four required scenario flows", () => {
    const ids = PRESET_SCENARIOS.map((p) => p.id);
    expect(ids).toContain("relay-verification");
    expect(ids).toContain("proof-pending");
    expect(ids).toContain("receipt-settlement");
    expect(ids).toContain("relay-operator-campaign");
    expect(PRESET_SCENARIOS.length).toBe(4);
  });

  it("contains deterministic and valid stats, accounts, mail, and audit logs for each scenario", () => {
    for (const scenario of PRESET_SCENARIOS) {
      expect(scenario.name.trim()).not.toBe("");
      expect(scenario.description.trim()).not.toBe("");
      expect(scenario.stats.length).toBeGreaterThan(0);
      expect(scenario.accounts.length).toBeGreaterThan(0);
      expect(scenario.mail.length).toBeGreaterThan(0);
      expect(scenario.attachments.length).toBeGreaterThan(0);
      expect(scenario.events.length).toBeGreaterThan(0);
      expect(scenario.auditEvents.length).toBeGreaterThan(0);

      // Verify stats shape
      for (const stat of scenario.stats) {
        expect(stat.label.trim()).not.toBe("");
        expect(stat.value.trim()).not.toBe("");
      }

      // Verify accounts shape
      for (const acct of scenario.accounts) {
        expect(acct.name.trim()).not.toBe("");
        expect(acct.address.trim()).not.toBe("");
        expect(acct.balance.trim()).not.toBe("");
        expect(acct.type.trim()).not.toBe("");
      }

      // Verify attachments shape
      for (const att of scenario.attachments) {
        expect(att.id.trim()).not.toBe("");
        expect(att.fileName.trim()).not.toBe("");
        expect(att.fileSize.trim()).not.toBe("");
        expect(att.fileType.trim()).not.toBe("");
        expect(att.messageSubject.trim()).not.toBe("");
        expect(att.sender.trim()).not.toBe("");
      }

      // Verify events shape
      for (const evt of scenario.events) {
        expect(evt.id.trim()).not.toBe("");
        expect(evt.title.trim()).not.toBe("");
        expect(evt.date.trim()).not.toBe("");
        expect(evt.time.trim()).not.toBe("");
        expect(evt.location.trim()).not.toBe("");
        expect(evt.organizer.trim()).not.toBe("");
        expect(["confirmed", "tentative", "cancelled"]).toContain(evt.status);
      }

      // Verify audit events shape
      for (const event of scenario.auditEvents) {
        expect(event.action.trim()).not.toBe("");
        expect(event.actor.trim()).not.toBe("");
        expect(event.timestamp.trim()).not.toBe("");
      }
    }
  });

  it("uses only safe, fake demo emails", () => {
    for (const scenario of PRESET_SCENARIOS) {
      for (const item of scenario.mail) {
        expect(item.email).toMatch(/(\*stealth\.demo|@example\.(com|org))$/);
      }
      for (const item of scenario.attachments) {
        if (item.sender.includes("@") || item.sender.includes("*")) {
          expect(item.sender).toMatch(/(\*stealth\.demo|@example\.(com|org))$/);
        }
      }
      for (const item of scenario.events) {
        if (item.organizer.includes("@") || item.organizer.includes("*")) {
          expect(item.organizer).toMatch(/(\*stealth\.demo|@example\.(com|org))$/);
        }
      }
      for (const item of scenario.campaignMetadata?.operatorPersonas ?? []) {
        expect(item.email).toMatch(/@example\.(com|org)$/);
        expect(item.handle).toMatch(/\*stealth\.demo$/);
      }
    }
  });

  it("attaches required relay verification metadata in relay verification scenario", () => {
    const relayVerification = PRESET_SCENARIOS.find((p) => p.id === "relay-verification");
    expect(relayVerification).toBeDefined();

    const pendingRelay = relayVerification?.accounts.find((a) => a.name === "Relay Node 07");
    expect(pendingRelay).toBeDefined();
    expect(pendingRelay?.relayMetadata).toBeDefined();
    expect(pendingRelay?.relayMetadata?.status).toBe("pending");
    expect(pendingRelay?.relayMetadata?.nodeUri).toBe("relay07*stealth.demo");

    const verificationMail = relayVerification?.mail.find(
      (m) => m.subject === "Your relay verification code",
    );
    expect(verificationMail).toBeDefined();
    expect(verificationMail?.status).toBe("pending");
    expect(verificationMail?.folder).toBe("pending");
    expect(verificationMail?.proofMetadata).toBeDefined();
  });

  it("attaches required proof pending metadata in proof pending scenario", () => {
    const proofPending = PRESET_SCENARIOS.find((p) => p.id === "proof-pending");
    expect(proofPending).toBeDefined();

    const pendingMail = proofPending?.mail.find(
      (m) => m.subject === "Soroban proof generation pending",
    );
    expect(pendingMail).toBeDefined();
    expect(pendingMail?.status).toBe("pending");
    expect(pendingMail?.folder).toBe("pending");
    expect(pendingMail?.proofMetadata).toBeDefined();
    expect(pendingMail?.proofMetadata?.postageStatus).toBe("pending");
  });

  it("attaches required receipt settlement metadata in receipt settlement scenario", () => {
    const receiptSettlement = PRESET_SCENARIOS.find((p) => p.id === "receipt-settlement");
    expect(receiptSettlement).toBeDefined();

    const deliveryReceiptMail = receiptSettlement?.mail.find(
      (m) => m.subject === "Delivery receipt settled",
    );
    expect(deliveryReceiptMail).toBeDefined();
    expect(deliveryReceiptMail?.status).toBe("delivered");
    expect(deliveryReceiptMail?.folder).toBe("receipts");
    expect(deliveryReceiptMail?.proofMetadata).toBeDefined();
    expect(deliveryReceiptMail?.proofMetadata?.postageStatus).toBe("settled");
  });

  it("defines relay operator campaign metadata, personas, and proof assignments", () => {
    const relayOperatorCampaign = PRESET_SCENARIOS.find(
      (p) => p.id === "relay-operator-campaign",
    );
    expect(relayOperatorCampaign).toBeDefined();
    expect(relayOperatorCampaign?.campaignMetadata).toBeDefined();
    expect(relayOperatorCampaign?.campaignMetadata?.issueNumber).toBe(269);
    expect(relayOperatorCampaign?.campaignMetadata?.initiative).toBe("Demo Admin Dashboard");
    expect(relayOperatorCampaign?.campaignMetadata?.campaignIssue).toBe("18 of 50");
    expect(relayOperatorCampaign?.campaignMetadata?.tags).toEqual(
      expect.arrayContaining(["demo-admin-dashboard", "demo-data", "Campaign"]),
    );

    const personas = relayOperatorCampaign?.campaignMetadata?.operatorPersonas ?? [];
    const assignments = relayOperatorCampaign?.campaignMetadata?.proofAssignments ?? [];
    expect(personas).toHaveLength(3);
    expect(assignments).toHaveLength(3);
    expect(assignments.map((assignment) => assignment.stage)).toEqual([
      "diagnostics",
      "verification-update",
      "proof-settlement",
    ]);

    const personaIds = new Set(personas.map((persona) => persona.id));
    for (const assignment of assignments) {
      expect(personaIds.has(assignment.operatorPersonaId)).toBe(true);
      expect(
        relayOperatorCampaign?.mail.some((mail) => mail.subject === assignment.messageSubject),
      ).toBe(true);
    }
  });

  it("represents relay diagnostics, verification updates, and proof settlement behavior", () => {
    const relayOperatorCampaign = PRESET_SCENARIOS.find(
      (p) => p.id === "relay-operator-campaign",
    );
    const behavior = relayOperatorCampaign?.campaignMetadata?.scenarioBehavior.join(" ");
    expect(behavior).toContain("diagnostics");
    expect(behavior).toContain("Verification updates");
    expect(behavior).toContain("Proof settlement");

    const proofStates = relayOperatorCampaign?.mail
      .map((mail) => mail.proofMetadata?.postageStatus)
      .filter(Boolean);
    expect(proofStates).toEqual(["pending", "pending", "settled"]);
  });
});
