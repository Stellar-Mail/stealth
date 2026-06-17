import { describe, it, expect, beforeEach } from "vitest";
import { MemoryApiRepository } from "../../src/server/api/memory-repository";
import {
  registerDevice,
  renameDevice,
  revokeDevice,
  flagDeviceCompromised,
  toggleDeviceTrust,
  rotateDeviceKeys,
  getDevicesWithSessions,
  getRecoveryStatus,
  checkSuspiciousLogin,
  createRecoveryMethod,
  deleteRecoveryMethod,
} from "../../src/server/api/device-service";

const TEST_ADDRESS = "GDQJMSGKJGQ2X576L33OY4JFDZ7NJG5OJ3LJ44V33PUPU7D5Q5X4KJ";

function makeRepo() {
  return new MemoryApiRepository();
}

describe("device-service", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = makeRepo();
  });

  describe("registerDevice", () => {
    it("creates a new device and session", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "Mozilla/5.0 (Macintosh)", ip: "192.168.1.10" },
        "PUBLIC_KEY_1",
      );

      expect(device.address).toBe(TEST_ADDRESS);
      expect(device.keyStatus).toBe("active");
      expect(device.type).toBe("desktop");
      expect(device.lastLocation).toBe("Private network");

      const sessions = await repo.listSessions(TEST_ADDRESS);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].deviceId).toBe(device.id);
    });

    it("returns existing device on duplicate fingerprint", async () => {
      const device1 = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "Mozilla/5.0 (Macintosh)", ip: "192.168.1.10" },
        "PUBLIC_KEY_1",
      );

      const device2 = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "Mozilla/5.0 (Macintosh)", ip: "192.168.1.10" },
        "PUBLIC_KEY_2",
      );

      expect(device2.id).toBe(device1.id);
    });

    it("rejects registration on revoked device", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "Mozilla/5.0 (Macintosh)", ip: "192.168.1.10" },
        "PUBLIC_KEY_1",
      );

      await repo.updateDeviceKeyStatus(device.id, "revoked");

      await expect(
        registerDevice(
          repo,
          TEST_ADDRESS,
          { userAgent: "Mozilla/5.0 (Macintosh)", ip: "192.168.1.10" },
          "PUBLIC_KEY_2",
        ),
      ).rejects.toThrow("device_revoked");
    });

    it("infers mobile type from user agent", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", ip: "10.0.0.1" },
        "PUBLIC_KEY_3",
      );

      expect(device.type).toBe("mobile");
    });
  });

  describe("renameDevice", () => {
    it("renames a device", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "TestAgent", ip: "10.0.0.1" },
        "PUBLIC_KEY",
      );

      const renamed = await renameDevice(repo, device.id, TEST_ADDRESS, "My Laptop");
      expect(renamed.name).toBe("My Laptop");
    });

    it("throws on non-existent device", async () => {
      await expect(
        renameDevice(repo, "non_existent", TEST_ADDRESS, "Name"),
      ).rejects.toThrow("device_not_found");
    });

    it("throws on address mismatch", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "TestAgent", ip: "10.0.0.1" },
        "PUBLIC_KEY",
      );

      await expect(
        renameDevice(repo, device.id, "GOTHER...ADDR", "Name"),
      ).rejects.toThrow("forbidden");
    });
  });

  describe("toggleDeviceTrust", () => {
    it("toggles trust status", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "TestAgent", ip: "10.0.0.1" },
        "PUBLIC_KEY",
      );

      const trusted = await toggleDeviceTrust(repo, device.id, TEST_ADDRESS, true);
      expect(trusted.trusted).toBe(true);

      const untrusted = await toggleDeviceTrust(repo, device.id, TEST_ADDRESS, false);
      expect(untrusted.trusted).toBe(false);
    });
  });

  describe("revokeDevice", () => {
    it("revokes a device and all its sessions", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "TestAgent", ip: "10.0.0.1" },
        "PUBLIC_KEY",
      );

      await revokeDevice(repo, device.id, TEST_ADDRESS);

      const stored = await repo.getDevice(device.id);
      expect(stored?.keyStatus).toBe("revoked");

      const sessions = await repo.listSessions(TEST_ADDRESS);
      expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
    });
  });

  describe("flagDeviceCompromised", () => {
    it("flags a device as compromised", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "TestAgent", ip: "10.0.0.1" },
        "PUBLIC_KEY",
      );

      await flagDeviceCompromised(repo, device.id, TEST_ADDRESS);

      const stored = await repo.getDevice(device.id);
      expect(stored?.keyStatus).toBe("compromised");
    });
  });

  describe("rotateDeviceKeys", () => {
    it("rotates keys for specified devices", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "TestAgent", ip: "10.0.0.1" },
        "OLD_KEY",
      );

      const rotated = await rotateDeviceKeys(repo, TEST_ADDRESS, [device.id], "NEW_KEY");

      expect(rotated).toHaveLength(1);
      expect(rotated[0].publicKey).toBe("NEW_KEY");
      expect(rotated[0].id).not.toBe(device.id); // new device created

      const old = await repo.getDevice(device.id);
      expect(old?.keyStatus).toBe("rotated");
    });
  });

  describe("getDevicesWithSessions", () => {
    it("returns devices with session info", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "TestAgent", ip: "10.0.0.1" },
        "PUBLIC_KEY",
      );

      const result = await getDevicesWithSessions(repo, TEST_ADDRESS, device.fingerprint);
      expect(result).toHaveLength(1);
      expect(result[0].isCurrent).toBe(true);
      expect(result[0].sessions).toHaveLength(1);
    });
  });

  describe("checkSuspiciousLogin", () => {
    it("returns not suspicious for unknown when no devices", async () => {
      const result = await checkSuspiciousLogin(repo, TEST_ADDRESS, "unknown_fp", "10.0.0.1");
      expect(result.suspicious).toBe(false);
    });

    it("detects unrecognized device", async () => {
      await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "TestAgent", ip: "10.0.0.1" },
        "PUBLIC_KEY",
      );

      const result = await checkSuspiciousLogin(repo, TEST_ADDRESS, "different_fp", "10.0.0.2");
      expect(result.suspicious).toBe(true);
      expect(result.reason).toBe("unrecognized_device");
    });

    it("detects compromised device", async () => {
      const device = await registerDevice(
        repo,
        TEST_ADDRESS,
        { userAgent: "TestAgent", ip: "10.0.0.1" },
        "PUBLIC_KEY",
      );
      await flagDeviceCompromised(repo, device.id, TEST_ADDRESS);

      const result = await checkSuspiciousLogin(
        repo,
        TEST_ADDRESS,
        device.fingerprint,
        "10.0.0.1",
      );
      expect(result.suspicious).toBe(true);
      expect(result.reason).toBe("device_compromised");
    });
  });

  describe("getRecoveryStatus", () => {
    it("returns disabled when no methods exist", async () => {
      const status = await getRecoveryStatus(repo, TEST_ADDRESS);
      expect(status.enabled).toBe(false);
      expect(status.recoveryMethods).toHaveLength(0);
    });

    it("returns enabled when recovery methods exist", async () => {
      await createRecoveryMethod(repo, TEST_ADDRESS, {
        type: "trusted_contact",
        label: "My Contact",
        value: "GD123...XYZ",
      });

      const status = await getRecoveryStatus(repo, TEST_ADDRESS);
      expect(status.enabled).toBe(true);
      expect(status.recoveryMethods).toHaveLength(1);
    });
  });

  describe("createRecoveryMethod / deleteRecoveryMethod", () => {
    it("creates and deletes recovery methods", async () => {
      const method = await createRecoveryMethod(repo, TEST_ADDRESS, {
        type: "hardware_key",
        label: "Ledger Nano X",
        value: "FINGERPRINT_123",
      });

      expect(method.type).toBe("hardware_key");
      expect(method.label).toBe("Ledger Nano X");

      await deleteRecoveryMethod(repo, method.id, TEST_ADDRESS);

      const stored = await repo.getRecoveryMethod(method.id);
      expect(stored).toBeNull();
    });

    it("throws on address mismatch when deleting", async () => {
      const method = await createRecoveryMethod(repo, TEST_ADDRESS, {
        type: "paper_key",
        label: "Backup Key",
        value: "PUBKEY_ABC",
      });

      await expect(
        deleteRecoveryMethod(repo, method.id, "GOTHER...ADDR"),
      ).rejects.toThrow("forbidden");
    });
  });
});
