import { useState, useEffect, useCallback } from "react";
import type { Device, RecoveryStatus } from "./types";

const MOCK_DEVICES: Device[] = [
  {
    id: "dev_001",
    address: "GDQ4...X4KJ",
    name: "MacBook Air",
    type: "desktop",
    fingerprint: "fp_current",
    publicKey: "GDQJMSGKJGQ2X576L33OY4JFDZ7NJG5OJ3LJ44V33PUPU7D5Q5X4KJ",
    keyStatus: "active",
    trusted: true,
    lastActive: new Date().toISOString(),
    lastIp: "192.168.1.10",
    lastLocation: "San Francisco, CA",
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    isCurrent: true,
    sessions: [
      {
        id: "sess_001",
        deviceId: "dev_001",
        address: "GDQ4...X4KJ",
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
        ip: "192.168.1.10",
        location: "San Francisco, CA",
        isCurrent: true,
        revokedAt: null,
      },
    ],
  },
  {
    id: "dev_002",
    address: "GDQ4...X4KJ",
    name: "iPhone 15 Pro",
    type: "mobile",
    fingerprint: "fp_iphone",
    publicKey: "GBRJ63...M2KN",
    keyStatus: "active",
    trusted: true,
    lastActive: new Date(Date.now() - 7200000).toISOString(),
    lastIp: "192.168.1.20",
    lastLocation: "San Francisco, CA",
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    isCurrent: false,
    sessions: [
      {
        id: "sess_002",
        deviceId: "dev_002",
        address: "GDQ4...X4KJ",
        startedAt: new Date(Date.now() - 86400000).toISOString(),
        lastActiveAt: new Date(Date.now() - 7200000).toISOString(),
        ip: "192.168.1.20",
        location: "San Francisco, CA",
        isCurrent: false,
        revokedAt: null,
      },
    ],
  },
  {
    id: "dev_003",
    address: "GDQ4...X4KJ",
    name: "Old Android Phone",
    type: "mobile",
    fingerprint: "fp_android",
    publicKey: "GCXK42...9PQR",
    keyStatus: "revoked",
    trusted: false,
    lastActive: new Date(Date.now() - 86400000 * 7).toISOString(),
    lastIp: "203.0.113.42",
    lastLocation: "Unknown location",
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    isCurrent: false,
    sessions: [],
  },
];

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>({
    enabled: true,
    lastUpdated: new Date(Date.now() - 86400000 * 3).toISOString(),
    devicesCount: 3,
    trustedCount: 2,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 150));
      setDevices(MOCK_DEVICES);
      setRecoveryStatus({
        enabled: true,
        lastUpdated: new Date(Date.now() - 86400000 * 3).toISOString(),
        devicesCount: MOCK_DEVICES.length,
        trustedCount: MOCK_DEVICES.filter((d) => d.trusted).length,
      });
      setLoading(false);
    };
    load();
  }, []);

  const renameDevice = useCallback(
    async (deviceId: string, name: string) => {
      await new Promise((r) => setTimeout(r, 100));
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, name } : d)),
      );
    },
    [],
  );

  const revokeDevice = useCallback(async (deviceId: string) => {
    await new Promise((r) => setTimeout(r, 100));
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === deviceId) {
          return {
            ...d,
            keyStatus: "revoked" as const,
            trusted: false,
            sessions: d.sessions.map((s) => ({ ...s, revokedAt: new Date().toISOString() })),
          };
        }
        return d;
      }),
    );
    setRecoveryStatus((prev) => ({
      ...prev,
      trustedCount: prev.trustedCount - (devices.find((d) => d.id === deviceId)?.trusted ? 1 : 0),
    }));
  }, [devices]);

  const flagCompromised = useCallback(async (deviceId: string) => {
    await new Promise((r) => setTimeout(r, 100));
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === deviceId) {
          return {
            ...d,
            keyStatus: "compromised" as const,
            trusted: false,
            sessions: d.sessions.map((s) => ({ ...s, revokedAt: new Date().toISOString() })),
          };
        }
        return d;
      }),
    );
    setRecoveryStatus((prev) => ({
      ...prev,
      trustedCount: prev.trustedCount - (devices.find((d) => d.id === deviceId)?.trusted ? 1 : 0),
    }));
  }, [devices]);

  return {
    devices,
    loading,
    recoveryStatus,
    renameDevice,
    revokeDevice,
    flagCompromised,
  };
}
