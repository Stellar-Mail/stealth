import { describe, expect, it } from "vitest";
import { validateAuthVersion } from "../../../../src/server/api/auth/envelope";
import { ApiError } from "../../../../src/server/api/errors";

describe("validateAuthVersion", () => {
  it("accepts a version that is in the active set", () => {
    const config = { activeVersions: new Set(["STEALTH-AUTH-V1", "STEALTH-AUTH-V2"]) };
    expect(() => validateAuthVersion("STEALTH-AUTH-V1", config)).not.toThrow();
    expect(() => validateAuthVersion("STEALTH-AUTH-V2", config)).not.toThrow();
  });

  it("throws a stable ApiError for an unsupported or deprecated version", () => {
    const config = { activeVersions: new Set(["STEALTH-AUTH-V2"]) };

    try {
      validateAuthVersion("STEALTH-AUTH-V1", config);
      expect.fail("Expected validateAuthVersion to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe("unauthorized");
      expect(apiError.status).toBe(401);
      expect(apiError.retryable).toBe(false);
      expect(apiError.details).toEqual({ version: "STEALTH-AUTH-V1" });
    }
  });

  it("models overlapping migration windows correctly", () => {
    // Both v1 and v2 are active during a migration window
    const migrationConfig = { activeVersions: new Set(["STEALTH-AUTH-V1", "STEALTH-AUTH-V2"]) };
    expect(() => validateAuthVersion("STEALTH-AUTH-V1", migrationConfig)).not.toThrow();
    expect(() => validateAuthVersion("STEALTH-AUTH-V2", migrationConfig)).not.toThrow();

    // After migration, v1 is deprecated
    const postMigrationConfig = { activeVersions: new Set(["STEALTH-AUTH-V2"]) };
    expect(() => validateAuthVersion("STEALTH-AUTH-V1", postMigrationConfig)).toThrowError(
      ApiError,
    );
    expect(() => validateAuthVersion("STEALTH-AUTH-V2", postMigrationConfig)).not.toThrow();
  });
});
