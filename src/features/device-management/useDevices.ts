import { useState, useEffect, useCallback } from "react";
import type { Device, RecoveryStatus } from "./types";

const API_BASE = "/api/v1";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const address = localStorage.getItem("stealth-address") ?? "GDQ4...X4KJ";
  const fingerprint = localStorage.getItem("stealth-fingerprint") ?? "";

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-stealth-address": address,
      "x-device-fingerprint": fingerprint,
      ...options.headers,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body?.error?.message ?? body?.message ?? `Request failed (${res.status})`);
  }

  return body.data ?? body;
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>({
    enabled: false,
    lastUpdated: null,
    devicesCount: 0,
    trustedCount: 0,
    recoveryMethods: [],
  });

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [devicesData, recoveryData] = await Promise.all([
        apiFetch<{ devices: Device[] }>("/devices"),
        apiFetch<RecoveryStatus>("/devices/recovery"),
      ]);
      setDevices(devicesData.devices);
      setRecoveryStatus(recoveryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const registerDevice = useCallback(
    async (publicKey: string) => {
      try {
        setError(null);
        await apiFetch("/devices/register", {
          method: "POST",
          body: JSON.stringify({
            publicKey,
            userAgent: navigator.userAgent,
            acceptLanguage: navigator.language,
            acceptEncoding: "gzip, deflate, br",
          }),
        });
        await loadDevices();
      } catch (err) {
        throw err;
      }
    },
    [loadDevices],
  );

  const renameDevice = useCallback(
    async (deviceId: string, name: string) => {
      try {
        setError(null);
        await apiFetch(`/devices/${deviceId}/name`, {
          method: "PUT",
          body: JSON.stringify({ name }),
        });
        setDevices((prev) =>
          prev.map((d) => (d.id === deviceId ? { ...d, name } : d)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename device");
        throw err;
      }
    },
    [],
  );

  const toggleTrust = useCallback(
    async (deviceId: string, trusted: boolean) => {
      try {
        setError(null);
        await apiFetch(`/devices/${deviceId}/trust`, {
          method: "POST",
          body: JSON.stringify({ trusted }),
        });
        setDevices((prev) =>
          prev.map((d) => (d.id === deviceId ? { ...d, trusted } : d)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update trust");
        throw err;
      }
    },
    [],
  );

  const revokeDevice = useCallback(
    async (deviceId: string) => {
      try {
        setError(null);
        await apiFetch(`/devices/${deviceId}/revoke`, {
          method: "POST",
        });
        setDevices((prev) =>
          prev.map((d) => {
            if (d.id === deviceId) {
              return {
                ...d,
                keyStatus: "revoked" as const,
                trusted: false,
                sessions: d.sessions.map((s) => ({
                  ...s,
                  revokedAt: new Date().toISOString(),
                })),
              };
            }
            return d;
          }),
        );
        await loadDevices();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revoke device");
        throw err;
      }
    },
    [loadDevices],
  );

  const flagCompromised = useCallback(
    async (deviceId: string) => {
      try {
        setError(null);
        await apiFetch(`/devices/${deviceId}/compromised`, {
          method: "POST",
        });
        setDevices((prev) =>
          prev.map((d) => {
            if (d.id === deviceId) {
              return {
                ...d,
                keyStatus: "compromised" as const,
                trusted: false,
                sessions: d.sessions.map((s) => ({
                  ...s,
                  revokedAt: new Date().toISOString(),
                })),
              };
            }
            return d;
          }),
        );
        await loadDevices();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to flag device as compromised");
        throw err;
      }
    },
    [loadDevices],
  );

  const rotateKeys = useCallback(
    async (deviceIds: string[], newPublicKey: string) => {
      try {
        setError(null);
        const result = await apiFetch<{ devices: Device[] }>("/devices/rotate-keys", {
          method: "POST",
          body: JSON.stringify({ deviceIds, newPublicKey }),
        });
        setDevices((prev) => {
          const kept = prev.filter((d) => !deviceIds.includes(d.id));
          return [...kept, ...result.devices];
        });
        return result.devices;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rotate keys");
        throw err;
      }
    },
    [],
  );

  const addRecoveryMethod = useCallback(
    async (type: string, label: string, value: string) => {
      try {
        setError(null);
        await apiFetch("/devices/recovery-methods", {
          method: "POST",
          body: JSON.stringify({ type, label, value }),
        });
        await loadDevices();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add recovery method");
        throw err;
      }
    },
    [loadDevices],
  );

  const removeRecoveryMethod = useCallback(
    async (methodId: string) => {
      try {
        setError(null);
        await apiFetch(`/devices/recovery-methods/${methodId}`, {
          method: "DELETE",
        });
        await loadDevices();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove recovery method");
        throw err;
      }
    },
    [loadDevices],
  );

  const dismissError = useCallback(() => setError(null), []);

  return {
    devices,
    loading,
    error,
    recoveryStatus,
    registerDevice,
    renameDevice,
    toggleTrust,
    revokeDevice,
    flagCompromised,
    rotateKeys,
    addRecoveryMethod,
    removeRecoveryMethod,
    dismissError,
    reload: loadDevices,
  };
}
