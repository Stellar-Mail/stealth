import { describe, it, expect } from "vitest";
import { migrateEnvelope } from "@/services/crypto/migrations";

describe("migrateEnvelope", () => {
  it("passes through v1 payloads untouched and retains original reference", () => {
    const originalV1 = {
      version: "v1",
      sender: "GBX...",
      recipient: "GCR...",
      timestamp: "2024-01-01T00:00:00Z",
      encryption_metadata: {
        algorithm: "AES-256-GCM",
        nonce: "abc",
        mac: "def",
      },
      content_commitment: "hash123",
      attachments: [{ filename: "test.txt", content_type: "text/plain", size_bytes: 100, content_hash: "hash" }],
    };

    const migrated = migrateEnvelope(originalV1);
    
    expect(migrated.model.version).toBe("v1");
    expect(migrated.model.sender).toBe("GBX...");
    expect(migrated.original).toBe(originalV1); // Exact reference match
  });

  it("migrates a legacy shape (no version, missing attachments) to v1", () => {
    const legacyShape = {
      sender: "GBX...",
      recipient: "GCR...",
      timestamp: "2023-12-01T00:00:00Z",
      encryption_metadata: {
        algorithm: "AES-256-GCM",
        nonce: "legacy_nonce",
        mac: "legacy_mac",
      },
      content_commitment: "hash456",
      // Notice: no version, no attachments
    };

    const migrated = migrateEnvelope(legacyShape);
    
    expect(migrated.model.version).toBe("v1"); // Added
    expect(migrated.model.attachments).toEqual([]); // Normalized to array
    expect(migrated.model.sender).toBe("GBX...");
    expect(migrated.original).toBe(legacyShape); // Kept original for signature verification
  });

  it("migrates a v0 shape to v1", () => {
    const v0Shape = {
      version: "v0",
      sender: "GBX...",
      recipient: "GCR...",
      timestamp: "2023-12-01T00:00:00Z",
      encryption_metadata: {
        algorithm: "AES-256-GCM",
        nonce: "legacy_nonce",
        mac: "legacy_mac",
      },
      content_commitment: "hash456",
    };

    const migrated = migrateEnvelope(v0Shape);
    
    expect(migrated.model.version).toBe("v1");
    expect(migrated.original).toBe(v0Shape);
  });

  it("fails securely on unknown future versions", () => {
    const futureShape = {
      version: "v2",
      sender: "GBX...",
      recipient: "GCR...",
    };

    expect(() => migrateEnvelope(futureShape)).toThrow("unsupported envelope version: v2");
  });

  it("fails if payload is not an object", () => {
    expect(() => migrateEnvelope(null)).toThrow("payload is missing");
    expect(() => migrateEnvelope("string")).toThrow("payload is missing");
  });
});
