import { describe, it, expect } from "vitest";
import { createContactExtractorService } from "../services/contact-extractor.service";
import { SAMPLE_EMAILS } from "../fixtures/sample-emails.fixtures";

describe("ContactExtractorService", () => {
  const svc = createContactExtractorService();

  describe("extract", () => {
    it("returns empty result for empty input", () => {
      const result = svc.extract("");
      expect(result.contacts).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    });

    it("returns empty result for whitespace-only input", () => {
      const result = svc.extract("   \n  \n  ");
      expect(result.contacts).toHaveLength(0);
    });

    it("extracts single contact from header", () => {
      const result = svc.extract(SAMPLE_EMAILS[0].raw);
      expect(result.contacts.length).toBeGreaterThanOrEqual(1);

      const headerContact = result.contacts.find((c) => c.source === "header");
      expect(headerContact).toBeDefined();
      expect(headerContact?.name).toBe("Alice Johnson");
      expect(headerContact?.email).toBe("alice@example.com");
    });

    it("extracts phone number from signature", () => {
      const result = svc.extract(SAMPLE_EMAILS[0].raw);
      const contactWithPhone = result.contacts.find((c) => c.phone);
      expect(contactWithPhone).toBeDefined();
      expect(contactWithPhone?.phone).toContain("555");
    });

    it("extracts multiple contacts from body", () => {
      const result = svc.extract(SAMPLE_EMAILS[1].raw);
      const bodyContacts = result.contacts.filter((c) => c.source === "body");
      expect(bodyContacts.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty contacts for message with no contacts", () => {
      const result = svc.extract(SAMPLE_EMAILS[2].raw);
      const contactsWithEmail = result.contacts.filter((c) => c.email);
      expect(contactsWithEmail).toHaveLength(0);
    });

    it("handles malformed From header gracefully", () => {
      const result = svc.extract(SAMPLE_EMAILS[3].raw);
      const headerContact = result.contacts.find((c) => c.source === "header");
      expect(headerContact).toBeUndefined();
    });

    it("deduplicates contacts with same email", () => {
      const result = svc.extract(SAMPLE_EMAILS[4].raw);
      const henryContacts = result.contacts.filter(
        (c) => c.email?.toLowerCase() === "henry@example.com",
      );
      expect(henryContacts).toHaveLength(1);
    });

    it("normalizes email to lowercase", () => {
      const result = svc.extract(SAMPLE_EMAILS[0].raw);
      const headerContact = result.contacts.find((c) => c.source === "header");
      expect(headerContact?.email).toBe("alice@example.com");
    });

    it("strips quotes from name", () => {
      const result = svc.extract(SAMPLE_EMAILS[0].raw);
      const headerContact = result.contacts.find((c) => c.source === "header");
      expect(headerContact?.name).not.toContain('"');
    });

    it("respects dedupe option set to false", () => {
      const result = svc.extract(SAMPLE_EMAILS[4].raw, {
        includeBody: true,
        dedupe: false,
      });
      const henryContacts = result.contacts.filter(
        (c) => c.email?.toLowerCase() === "henry@example.com",
      );
      expect(henryContacts.length).toBeGreaterThan(1);
    });

    it("extracts organization from signature", () => {
      const result = svc.extract(SAMPLE_EMAILS[5].raw);
      const contactWithOrg = result.contacts.find((c) => c.organization);
      expect(contactWithOrg).toBeDefined();
      expect(contactWithOrg?.organization).toContain("Acme");
    });
  });

  describe("deduplicate", () => {
    it("removes contacts with duplicate emails", () => {
      const contacts = [
        {
          id: "1",
          name: "Alice",
          email: "alice@example.com",
          phone: null,
          organization: null,
          source: "header" as const,
        },
        {
          id: "2",
          name: "Alice",
          email: "alice@example.com",
          phone: null,
          organization: null,
          source: "body" as const,
        },
        {
          id: "3",
          name: "Bob",
          email: "bob@example.com",
          phone: null,
          organization: null,
          source: "header" as const,
        },
      ];
      const result = svc.deduplicate(contacts);
      expect(result).toHaveLength(2);
    });

    it("preserves contacts with null emails", () => {
      const contacts = [
        {
          id: "1",
          name: "Unknown",
          email: null,
          phone: null,
          organization: null,
          source: "header" as const,
        },
      ];
      const result = svc.deduplicate(contacts);
      expect(result).toHaveLength(1);
    });
  });

  describe("with fixtures", () => {
    it("processes all sample emails without throwing", () => {
      for (const fixture of SAMPLE_EMAILS) {
        expect(() => svc.extract(fixture.raw)).not.toThrow();
      }
    });

    it("produces deterministic contact data (ignoring ids)", () => {
      const stripIds = (c: {
        id: string;
        name: string | null;
        email: string | null;
        phone: string | null;
        organization: string | null;
        source: "header" | "signature" | "body";
      }) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        organization: c.organization,
        source: c.source,
      });
      for (const fixture of SAMPLE_EMAILS) {
        const first = svc.extract(fixture.raw);
        const second = svc.extract(fixture.raw);
        expect(first.contacts.map(stripIds)).toEqual(second.contacts.map(stripIds));
      }
    });
  });
});
