import { describe, expect, it } from "vitest";
import { validateAndNormalizeDemoData, serializeDemoData } from "../utils/demoDataIo";
import { defaultDemoDashboardData } from "../fixtures/demoDataFixtures";
import { DemoDashboardData } from "../types/demoData";

describe("demoDataIo", () => {
  describe("validateAndNormalizeDemoData", () => {
    it("successfully parses, validates, and normalizes a complete valid JSON structure", () => {
      const validJson = JSON.stringify(defaultDemoDashboardData);
      const result = validateAndNormalizeDemoData(validJson);

      expect(result.accounts).toHaveLength(defaultDemoDashboardData.accounts.length);
      expect(result.mail).toHaveLength(defaultDemoDashboardData.mail.length);
      expect(result.audit).toHaveLength(defaultDemoDashboardData.audit.length);

      expect(result.accounts[0].name).toBe("Alice Demo");
      expect(result.mail[0].status).toBe("delivered");
      // Timestamp must be normalized to a standard ISO string
      expect(result.audit[0].timestamp).toBe("2026-06-16T09:00:00.000Z");
    });

    it("handles missing sections by defaulting them to empty arrays", () => {
      const partialJson = JSON.stringify({
        accounts: [{ name: "Alice Demo", address: "GABCD", balance: "10 XLM", type: "User" }],
      });
      const result = validateAndNormalizeDemoData(partialJson);

      expect(result.accounts).toHaveLength(1);
      expect(result.mail).toEqual([]);
      expect(result.audit).toEqual([]);
    });

    it("trims whitespace from input strings", () => {
      const whitespaceData = {
        accounts: [{ name: "  Alice Demo  ", address: " GABCD ", balance: " 10 XLM ", type: " User " }],
        mail: [{ subject: "  Welcome  ", status: "  delivered  ", folder: "  inbox  " }],
        audit: [{ action: "  Session started  ", actor: "  demo-user  ", timestamp: "  2026-06-16T09:00:00Z  " }],
      };
      const result = validateAndNormalizeDemoData(JSON.stringify(whitespaceData));

      expect(result.accounts[0].name).toBe("Alice Demo");
      expect(result.accounts[0].address).toBe("GABCD");
      expect(result.accounts[0].balance).toBe("10 XLM");
      expect(result.accounts[0].type).toBe("User");

      expect(result.mail[0].subject).toBe("Welcome");
      expect(result.mail[0].status).toBe("delivered");
      expect(result.mail[0].folder).toBe("inbox");

      expect(result.audit[0].action).toBe("Session started");
      expect(result.audit[0].actor).toBe("demo-user");
      expect(result.audit[0].timestamp).toBe("2026-06-16T09:00:00.000Z");
    });

    it("throws informative error when JSON is malformed", () => {
      const malformedJson = "{ accounts: [ { name: 'missing quotes' } ]";
      expect(() => validateAndNormalizeDemoData(malformedJson)).toThrow(/Invalid JSON format/);
    });

    it("throws error when root is not an object", () => {
      expect(() => validateAndNormalizeDemoData("null")).toThrow(/Root must be a JSON object/);
      expect(() => validateAndNormalizeDemoData("[]")).toThrow(/Root must be a JSON object/);
      expect(() => validateAndNormalizeDemoData('"string"')).toThrow(/Root must be a JSON object/);
    });

    it("throws error when sections are not arrays", () => {
      expect(() => validateAndNormalizeDemoData(JSON.stringify({ accounts: "not-an-array" }))).toThrow(
        /'accounts' must be an array/
      );
      expect(() => validateAndNormalizeDemoData(JSON.stringify({ mail: {} }))).toThrow(
        /'mail' must be an array/
      );
    });

    describe("Accounts validation", () => {
      it("throws error when account item is not an object", () => {
        expect(() =>
          validateAndNormalizeDemoData(JSON.stringify({ accounts: ["string-item"] }))
        ).toThrow(/Each account must be an object/);
      });

      it("throws error when account is missing required fields", () => {
        expect(() =>
          validateAndNormalizeDemoData(
            JSON.stringify({ accounts: [{ name: "Alice", address: "GABCD" }] })
          )
        ).toThrow(/Account is missing required field/);
      });

      it("throws error when account fields are not strings", () => {
        expect(() =>
          validateAndNormalizeDemoData(
            JSON.stringify({
              accounts: [{ name: "Alice", address: "GABCD", balance: 500, type: "User" }],
            })
          )
        ).toThrow(/Account fields.*must be strings/);
      });

      it("throws error when account address does not start with 'G'", () => {
        expect(() =>
          validateAndNormalizeDemoData(
            JSON.stringify({
              accounts: [{ name: "Alice", address: "ABCD", balance: "500 XLM", type: "User" }],
            })
          )
        ).toThrow(/Account address must start with 'G'/);
      });

      it("throws error when account fields are empty or only whitespace", () => {
        expect(() =>
          validateAndNormalizeDemoData(
            JSON.stringify({
              accounts: [{ name: " ", address: "GABCD", balance: "500 XLM", type: "User" }],
            })
          )
        ).toThrow(/Account name cannot be empty/);
      });
    });

    describe("Mail validation", () => {
      it("throws error when mail item is missing required fields", () => {
        expect(() =>
          validateAndNormalizeDemoData(JSON.stringify({ mail: [{ subject: "Welcome" }] }))
        ).toThrow(/Mail item is missing required field/);
      });

      it("throws error when mail status is invalid", () => {
        expect(() =>
          validateAndNormalizeDemoData(
            JSON.stringify({ mail: [{ subject: "Welcome", status: "draft", folder: "inbox" }] })
          )
        ).toThrow(/Mail status must be 'delivered', 'pending', or 'held'/);
      });

      it("throws error when mail fields are empty", () => {
        expect(() =>
          validateAndNormalizeDemoData(
            JSON.stringify({ mail: [{ subject: "Welcome", status: "delivered", folder: " " }] })
          )
        ).toThrow(/Mail folder cannot be empty/);
      });
    });

    describe("Audit events validation", () => {
      it("throws error when audit event is missing required fields", () => {
        expect(() =>
          validateAndNormalizeDemoData(JSON.stringify({ audit: [{ action: "started" }] }))
        ).toThrow(/Audit event is missing required field/);
      });

      it("throws error when audit timestamp is an invalid date", () => {
        expect(() =>
          validateAndNormalizeDemoData(
            JSON.stringify({
              audit: [{ action: "started", actor: "user", timestamp: "not-a-date" }],
            })
          )
        ).toThrow(/is not a valid date/);
      });
    });
  });

  describe("serializeDemoData", () => {
    it("serializes to a pretty-printed 2-spaced JSON string", () => {
      const data: DemoDashboardData = {
        accounts: [{ name: "Alice", address: "GABCD", balance: "10 XLM", type: "User" }],
        mail: [],
        audit: [],
      };
      const serialized = serializeDemoData(data);
      const lines = serialized.split("\n");

      // Verify that formatting matches expectation (indentation of 2 spaces)
      expect(lines[1]).toBe('  "accounts": [');
      expect(lines[2]).toBe("    {");
      expect(lines[3]).toBe('      "name": "Alice",');
    });
  });

  describe("round trip", () => {
    it("preserves values exactly on a serialization -> parsing round trip", () => {
      const initialData: DemoDashboardData = {
        accounts: [{ name: "Test User", address: "GAAAA", balance: "100 XLM", type: "User" }],
        mail: [{ subject: "Hello", status: "pending", folder: "inbox" }],
        audit: [{ action: "Test Action", actor: "actor", timestamp: "2026-06-16T21:40:00.000Z" }],
      };

      const serialized = serializeDemoData(initialData);
      const parsed = validateAndNormalizeDemoData(serialized);

      expect(parsed).toEqual(initialData);
    });
  });
});
