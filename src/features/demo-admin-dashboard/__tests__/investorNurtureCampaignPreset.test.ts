import { describe, expect, it } from "vitest";
import { investorNurtureCampaignPreset } from "../fixtures/investorNurtureCampaignPreset";
import { CAMPAIGN_KPI_DEFINITIONS } from "../fixtures/campaignKpiFixtures";
import { PRESET_SCENARIOS } from "../fixtures/presets";

describe("investorNurtureCampaignPreset", () => {
  it("has the correct id, name, and description", () => {
    expect(investorNurtureCampaignPreset.id).toBe("investor-nurture");
    expect(investorNurtureCampaignPreset.name).toBe("Investor Nurture");
    expect(investorNurtureCampaignPreset.description.trim()).not.toBe("");
  });

  it("includes 4 stats", () => {
    expect(investorNurtureCampaignPreset.stats).toHaveLength(4);
    for (const stat of investorNurtureCampaignPreset.stats) {
      expect(stat.label.trim()).not.toBe("");
      expect(stat.value.trim()).not.toBe("");
    }
  });

  it("includes accounts with required fields", () => {
    expect(investorNurtureCampaignPreset.accounts.length).toBeGreaterThan(0);
    for (const acct of investorNurtureCampaignPreset.accounts) {
      expect(acct.name.trim()).not.toBe("");
      expect(acct.address.trim()).not.toBe("");
      expect(acct.balance.trim()).not.toBe("");
      expect(acct.type.trim()).not.toBe("");
    }
  });

  it("includes 4 mail items with required fields", () => {
    expect(investorNurtureCampaignPreset.mail).toHaveLength(4);
    for (const mail of investorNurtureCampaignPreset.mail) {
      expect(mail.subject.trim()).not.toBe("");
      expect(mail.body.trim()).not.toBe("");
      expect(mail.from.trim()).not.toBe("");
      expect(mail.email.trim()).not.toBe("");
    }
  });

  it("uses only safe demo email addresses", () => {
    for (const mail of investorNurtureCampaignPreset.mail) {
      expect(mail.email).toMatch(/(\*stealth\.demo|@example\.(com|org))$/);
    }
    for (const evt of investorNurtureCampaignPreset.events) {
      if (evt.organizer.includes("*") || evt.organizer.includes("@")) {
        expect(evt.organizer).toMatch(/(\*stealth\.demo|@example\.(com|org))$/);
      }
    }
  });

  it("includes 3 attachments linked to mail subjects", () => {
    expect(investorNurtureCampaignPreset.attachments).toHaveLength(3);
    const mailSubjects = investorNurtureCampaignPreset.mail.map((m) => m.subject);
    for (const att of investorNurtureCampaignPreset.attachments) {
      expect(att.id.trim()).not.toBe("");
      expect(att.fileName.trim()).not.toBe("");
      expect(att.fileSize.trim()).not.toBe("");
      expect(att.fileType.trim()).not.toBe("");
      expect(mailSubjects).toContain(att.messageSubject);
    }
  });

  it("includes 1 confirmed calendar event", () => {
    expect(investorNurtureCampaignPreset.events).toHaveLength(1);
    const evt = investorNurtureCampaignPreset.events[0];
    expect(evt.status).toBe("confirmed");
    expect(evt.title.trim()).not.toBe("");
    expect(evt.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("includes 4 audit events with valid timestamps", () => {
    expect(investorNurtureCampaignPreset.auditEvents).toHaveLength(4);
    for (const event of investorNurtureCampaignPreset.auditEvents) {
      expect(event.action.trim()).not.toBe("");
      expect(event.actor.trim()).not.toBe("");
      expect(() => new Date(event.timestamp)).not.toThrow();
    }
  });

  it("includes proof metadata on postage-settled mail items", () => {
    const settledMail = investorNurtureCampaignPreset.mail.filter(
      (m) => m.proofMetadata?.postageStatus === "settled",
    );
    expect(settledMail.length).toBeGreaterThan(0);
    for (const mail of settledMail) {
      expect(mail.proofMetadata?.messageHash.trim()).not.toBe("");
      expect(mail.proofMetadata?.signature.trim()).not.toBe("");
    }
  });

  it("is included in PRESET_SCENARIOS", () => {
    const ids = PRESET_SCENARIOS.map((p) => p.id);
    expect(ids).toContain("investor-nurture");
  });
});

describe("investor-nurture KPI definitions", () => {
  const investorKpis = CAMPAIGN_KPI_DEFINITIONS.filter(
    (k) => k.campaignId === "campaign-investor-nurture",
  );

  it("defines exactly 6 KPIs for the investor nurture campaign", () => {
    expect(investorKpis).toHaveLength(6);
  });

  it("covers all required metric kinds", () => {
    const metrics = investorKpis.map((k) => k.metric);
    expect(metrics).toContain("opens");
    expect(metrics).toContain("replies");
    expect(metrics).toContain("approvals");
    expect(metrics).toContain("refunds");
    expect(metrics).toContain("proof_inspections");
    expect(metrics).toContain("conversions");
  });

  it("has valid fields on every KPI", () => {
    for (const kpi of investorKpis) {
      expect(kpi.id.trim()).not.toBe("");
      expect(kpi.label.trim()).not.toBe("");
      expect(kpi.description.trim()).not.toBe("");
      expect(kpi.target).toBeGreaterThan(0);
      expect(kpi.currentValue).toBeGreaterThanOrEqual(0);
      expect(["on-track", "at-risk", "met", "missed"]).toContain(kpi.status);
      expect(["up", "down", "stable"]).toContain(kpi.trend);
    }
  });
});
