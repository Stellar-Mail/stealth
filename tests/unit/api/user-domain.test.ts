import { describe, expect, it } from "vitest";
import {
  accountStatusSchema,
  emailSchema,
  usernameSchema,
  userSchema,
  profileSchema,
  credentialSchema,
  toPublicUser,
  toPublicProfile,
} from "../../../src/server/api/domain";

describe("BETA-002: User Account, Profile, and Credential Domain Schemas & Projections", () => {
  const validStellarAddress = `G${"A".repeat(55)}`;

  describe("AccountStatus", () => {
    it("accepts valid statuses", () => {
      expect(accountStatusSchema.parse("active")).toBe("active");
      expect(accountStatusSchema.parse("suspended")).toBe("suspended");
      expect(accountStatusSchema.parse("pending_verification")).toBe("pending_verification");
      expect(accountStatusSchema.parse("deactivated")).toBe("deactivated");
    });

    it("rejects invalid statuses", () => {
      expect(() => accountStatusSchema.parse("banned")).toThrow();
    });
  });

  describe("emailSchema & usernameSchema normalization", () => {
    it("normalizes email addresses to lowercase trimmed strings", () => {
      expect(emailSchema.parse("  Alice@Stealth.Mail  ")).toBe("alice@stealth.mail");
    });

    it("normalizes usernames to lowercase trimmed strings", () => {
      expect(usernameSchema.parse("  Alice_Stealth123  ")).toBe("alice_stealth123");
    });

    it("rejects invalid email formats", () => {
      expect(() => emailSchema.parse("invalid-email")).toThrow();
    });

    it("rejects usernames that are too short or contain invalid characters", () => {
      expect(() => usernameSchema.parse("ab")).toThrow(); // min 3 chars
      expect(() => usernameSchema.parse("user@name")).toThrow(); // special chars disallowed
    });
  });

  describe("userSchema", () => {
    it("parses valid User records", () => {
      const input = {
        userId: "usr_12345",
        address: validStellarAddress,
        email: "BOB@STEALTH.MAIL",
        username: "Bob_Builder",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
      };

      const parsed = userSchema.parse(input);
      expect(parsed.email).toBe("bob@stealth.mail");
      expect(parsed.username).toBe("bob_builder");
      expect(parsed.version).toBe(1);
    });
  });

  describe("credentialSchema", () => {
    it("parses valid Credential records", () => {
      const credential = {
        credentialId: "cred_999",
        userId: "usr_12345",
        authMethod: "passkey",
        secretHash: "argon2id$v=19$m=65536,t=3,p=4$hash",
        walletKeyRef: "vault_ref_123",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const parsed = credentialSchema.parse(credential);
      expect(parsed.authMethod).toBe("passkey");
      expect(parsed.secretHash).toBeDefined();
    });
  });

  describe("audit-safe projections (toPublicUser & toPublicProfile)", () => {
    it("strips all internal versioning and sensitive fields for publicUser", () => {
      const user = userSchema.parse({
        userId: "usr_12345",
        address: validStellarAddress,
        email: "alice@stealth.mail",
        username: "alice_privacy",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 5,
      });

      const publicUser = toPublicUser(user);

      expect(publicUser).toEqual({
        userId: "usr_12345",
        address: validStellarAddress,
        email: "alice@stealth.mail",
        username: "alice_privacy",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });

      // Ensure secretHash and walletKeyRef keys do not exist on public projection
      expect(publicUser).not.toHaveProperty("secretHash");
      expect(publicUser).not.toHaveProperty("walletKeyRef");
      expect(publicUser).not.toHaveProperty("version");
    });

    it("projects publicProfile correctly", () => {
      const profile = profileSchema.parse({
        userId: "usr_12345",
        username: "alice_privacy",
        displayName: "Alice P.",
        avatarUrl: "https://stealth.mail/avatar.jpg",
        bio: "Privacy is a fundamental human right.",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });

      const publicProfile = toPublicProfile(profile);

      expect(publicProfile).toEqual({
        userId: "usr_12345",
        username: "alice_privacy",
        displayName: "Alice P.",
        avatarUrl: "https://stealth.mail/avatar.jpg",
        avatarMetadata: null,
        bio: "Privacy is a fundamental human right.",
        locale: "en",
        timezone: "UTC",
        addressDisplay: "truncated",
        notifications: {
          email: true,
          desktop: true,
          sound: false,
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    });
  });
});
