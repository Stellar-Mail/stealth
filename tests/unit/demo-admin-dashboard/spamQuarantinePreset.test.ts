import { describe, expect, it } from "vitest";
import {
  blockedPersonas,
  getQuarantineSummary,
  quarantineEntries,
  spamQuarantineScenarioPreset,
  spamWarningLabels,
  validateSpamQuarantinePreset,
} from "../../../src/features/demo-admin-dashboard/fixtures/spamQuarantinePreset";
import { PRESET_SCENARIOS } from "../../../src/features/demo-admin-dashboard/fixtures/presets";

describe("spamQuarantinePreset — quarantine entries", () => {
  it("covers all five required quarantine entry statuses", () => {
    const statuses = quarantineEntries.map((e) => e.status);
    expect(statuses).toContain("spam-auto-detected");
    expect(statuses).toContain("blocked-no-postage");
    expect(statuses).toContain("blocked-policy-mismatch");
    expect(statuses).toContain("blocked-repeat-offender");
    expect(statuses).toContain("cleared-false-positive");
  });

  it("has a non-empty reason and reviewNote on every entry", () => {
    for (const entry of quarantineEntries) {
      expect(entry.reason.trim()).not.toBe("");
      expect(entry.reviewNote.trim()).not.toBe("");
    }
  });

  it("uses safe fake sender addresses", () => {
    const safePattern = /(@example\.(com|org)|\*stealth\.demo)$/;
    for (const entry of quarantineEntries) {
      expect(entry.senderAddress).toMatch(safePattern);
    }
  });
});

describe("spamQuarantinePreset — blocked personas", () => {
  it("defines at least 3 blocked personas", () => {
    expect(blockedPersonas.length).toBeGreaterThanOrEqual(3);
  });

  it("each persona has a blockReason and a valid blockCategory", () => {
    const validCategories = ["spam", "policy-violation", "no-postage", "repeat-offender"];
    for (const persona of blockedPersonas) {
      expect(persona.blockReason.trim()).not.toBe("");
      expect(validCategories).toContain(persona.blockCategory);
    }
  });

  it("blocked persona addresses are safe fake emails", () => {
    const safePattern = /(@example\.(com|org)|\*stealth\.demo)$/;
    for (const persona of blockedPersonas) {
      expect(persona.address).toMatch(safePattern);
    }
  });

  it("blocked persona ids are unique", () => {
    const ids = blockedPersonas.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("spamQuarantinePreset — warning labels", () => {
  it("defines the five required warning labels", () => {
    const names = spamWarningLabels.map((l) => l.name);
    expect(names).toContain("Spam");
    expect(names).toContain("Blocked");
    expect(names).toContain("Quarantine");
    expect(names).toContain("Review-Pending");
    expect(names).toContain("Cleared");
  });

  it("each label has a valid severity and non-empty description", () => {
    for (const label of spamWarningLabels) {
      expect(["info", "warning", "danger"]).toContain(label.severity);
      expect(label.description.trim()).not.toBe("");
    }
  });
});

describe("spamQuarantineScenarioPreset", () => {
  it("has the correct id, name, and non-empty description", () => {
    expect(spamQuarantineScenarioPreset.id).toBe("spam-quarantine");
    expect(spamQuarantineScenarioPreset.name).toBe("Spam and Quarantine Review");
    expect(spamQuarantineScenarioPreset.description.trim()).not.toBe("");
  });

  it("includes 4 stats with non-empty label and value", () => {
    expect(spamQuarantineScenarioPreset.stats).toHaveLength(4);
    for (const stat of spamQuarantineScenarioPreset.stats) {
      expect(stat.label.trim()).not.toBe("");
      expect(stat.value.trim()).not.toBe("");
    }
  });

  it("includes accounts with required fields", () => {
    expect(spamQuarantineScenarioPreset.accounts.length).toBeGreaterThan(0);
    for (const acct of spamQuarantineScenarioPreset.accounts) {
      expect(acct.name.trim()).not.toBe("");
      expect(acct.address.trim()).not.toBe("");
      expect(acct.balance.trim()).not.toBe("");
      expect(acct.type.trim()).not.toBe("");
    }
  });

  it("includes mail items in both quarantine and inbox folders", () => {
    const folders = spamQuarantineScenarioPreset.mail.map((m) => m.folder);
    expect(folders).toContain("quarantine");
    expect(folders).toContain("inbox");
  });

  it("uses only safe demo email addresses in mail", () => {
    const safePattern = /(\*stealth\.demo|@example\.(com|org))$/;
    for (const mail of spamQuarantineScenarioPreset.mail) {
      expect(mail.email).toMatch(safePattern);
    }
  });

  it("includes at least 3 attachments linked to existing mail subjects", () => {
    expect(spamQuarantineScenarioPreset.attachments.length).toBeGreaterThanOrEqual(3);
    const mailSubjects = spamQuarantineScenarioPreset.mail.map((m) => m.subject);
    for (const att of spamQuarantineScenarioPreset.attachments) {
      expect(att.id.trim()).not.toBe("");
      expect(att.fileName.trim()).not.toBe("");
      expect(att.fileSize.trim()).not.toBe("");
      expect(att.fileType.trim()).not.toBe("");
      expect(mailSubjects).toContain(att.messageSubject);
    }
  });

  it("includes at least 1 confirmed calendar event with a valid date", () => {
    expect(spamQuarantineScenarioPreset.events.length).toBeGreaterThanOrEqual(1);
    const confirmed = spamQuarantineScenarioPreset.events.filter((e) => e.status === "confirmed");
    expect(confirmed.length).toBeGreaterThanOrEqual(1);
    for (const evt of spamQuarantineScenarioPreset.events) {
      expect(evt.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("includes at least 5 audit events with valid timestamps", () => {
    expect(spamQuarantineScenarioPreset.auditEvents.length).toBeGreaterThanOrEqual(5);
    for (const event of spamQuarantineScenarioPreset.auditEvents) {
      expect(event.action.trim()).not.toBe("");
      expect(event.actor.trim()).not.toBe("");
      expect(() => new Date(event.timestamp)).not.toThrow();
    }
  });

  it("is registered in PRESET_SCENARIOS", () => {
    const ids = PRESET_SCENARIOS.map((p) => p.id);
    expect(ids).toContain("spam-quarantine");
  });
});

describe("getQuarantineSummary", () => {
  it("returns a summary covering spam, blocked, and cleared counts", () => {
    const summary = getQuarantineSummary();
    expect(summary).toMatch(/5 quarantine entries/);
    expect(summary).toMatch(/1 spam/);
    expect(summary).toMatch(/3 blocked/);
    expect(summary).toMatch(/1 cleared/);
  });

  it("handles an empty list without throwing", () => {
    expect(() => getQuarantineSummary([])).not.toThrow();
    expect(getQuarantineSummary([])).toMatch(/0 quarantine entries/);
  });
});

describe("validateSpamQuarantinePreset", () => {
  it("returns no errors for the default preset", () => {
    expect(validateSpamQuarantinePreset()).toEqual([]);
  });

  it("reports an error when a required quarantine status is missing", () => {
    const trimmedEntries = quarantineEntries.filter(
      (e) => e.status !== "cleared-false-positive",
    );
    const errors = validateSpamQuarantinePreset(
      spamQuarantineScenarioPreset,
      trimmedEntries,
      blockedPersonas,
    );
    expect(errors).toContain("Missing quarantine entry status: cleared-false-positive");
  });

  it("reports an error for an unsafe email address in mail", () => {
    const unsafeMail = {
      ...spamQuarantineScenarioPreset.mail[0],
      email: "real@person.io",
    };
    const modifiedPreset = {
      ...spamQuarantineScenarioPreset,
      mail: [unsafeMail, ...spamQuarantineScenarioPreset.mail.slice(1)],
    };
    const errors = validateSpamQuarantinePreset(
      modifiedPreset,
      quarantineEntries,
      blockedPersonas,
    );
    expect(errors.some((e) => e.includes("Unsafe email address"))).toBe(true);
  });
});
