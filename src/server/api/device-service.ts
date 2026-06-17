import { buildDeviceFingerprint } from "./abuse-service";
import type { Device, DeviceCreate, RecoveryMethod, RecoveryMethodCreate, Session } from "./domain";
import type { ApiRepository } from "./repository";

export type DeviceWithSessions = Device & { sessions: Session[] };

function inferDeviceType(userAgent: string): Device["type"] {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) return "mobile";
  if (/tablet|ipad/i.test(ua)) return "tablet";
  return "desktop";
}

function inferLocation(ip: string): string {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return "Local network";
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return "Private network";
  return "Unknown location";
}

export async function getDevicesWithSessions(
  repository: ApiRepository,
  address: string,
  currentFingerprint?: string,
): Promise<DeviceWithSessions[]> {
  const devices = await repository.listDevices(address);
  const sessions = await repository.listSessions(address);

  return devices.map((device) => {
    let isCurrent = false;
    if (currentFingerprint && device.fingerprint === currentFingerprint) {
      isCurrent = true;
    }
    const deviceSessions = sessions
      .filter((s) => s.deviceId === device.id)
      .map((s) => ({ ...s, isCurrent: s.isCurrent && isCurrent }));

    const lastActive =
      deviceSessions.length > 0
        ? deviceSessions.sort(
            (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
          )[0].lastActiveAt
        : device.lastActive;

    return {
      ...device,
      isCurrent,
      lastActive,
      sessions: deviceSessions,
    };
  });
}

export async function registerDevice(
  repository: ApiRepository,
  address: string,
  headers: { userAgent?: string; acceptLanguage?: string; acceptEncoding?: string; ip?: string },
  publicKey: string,
): Promise<Device> {
  const fingerprint = buildDeviceFingerprint({
    userAgent: headers.userAgent,
    acceptLanguage: headers.acceptLanguage,
    acceptEncoding: headers.acceptEncoding,
    ipPrefix: headers.ip?.split(".").slice(0, 2).join("."),
  });

  const existing = await repository.getDeviceByFingerprint(address, fingerprint);
  if (existing) {
    if (existing.keyStatus === "revoked" || existing.keyStatus === "compromised") {
      throw new Error("device_revoked");
    }
    return existing;
  }

  const deviceType = inferDeviceType(headers.userAgent ?? "");
  const location = inferLocation(headers.ip ?? "");

  const device = await repository.createDevice(address, {
    name: `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)}`,
    type: deviceType,
    fingerprint,
    publicKey,
    lastIp: headers.ip ?? "unknown",
    lastLocation: location,
  });

  await repository.createSession({
    id: crypto.randomUUID(),
    deviceId: device.id,
    address,
    startedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    ip: headers.ip ?? "unknown",
    location,
    isCurrent: true,
    revokedAt: null,
  });

  return device;
}

export async function renameDevice(
  repository: ApiRepository,
  deviceId: string,
  address: string,
  name: string,
): Promise<Device> {
  const device = await repository.getDevice(deviceId);
  if (!device) throw new Error("device_not_found");
  if (device.address !== address) throw new Error("forbidden");
  return repository.updateDevice(deviceId, { name });
}

export async function toggleDeviceTrust(
  repository: ApiRepository,
  deviceId: string,
  address: string,
  trusted: boolean,
): Promise<Device> {
  const device = await repository.getDevice(deviceId);
  if (!device) throw new Error("device_not_found");
  if (device.address !== address) throw new Error("forbidden");
  return repository.updateDevice(deviceId, { trusted });
}

export async function revokeDevice(
  repository: ApiRepository,
  deviceId: string,
  address: string,
): Promise<void> {
  const device = await repository.getDevice(deviceId);
  if (!device) throw new Error("device_not_found");
  if (device.address !== address) throw new Error("forbidden");

  await repository.updateDeviceKeyStatus(deviceId, "revoked");
  await repository.revokeAllSessionsForDevice(deviceId);
}

export async function flagDeviceCompromised(
  repository: ApiRepository,
  deviceId: string,
  address: string,
): Promise<void> {
  const device = await repository.getDevice(deviceId);
  if (!device) throw new Error("device_not_found");
  if (device.address !== address) throw new Error("forbidden");

  await repository.updateDeviceKeyStatus(deviceId, "compromised");
  await repository.revokeAllSessionsForDevice(deviceId);
}

export async function rotateDeviceKeys(
  repository: ApiRepository,
  address: string,
  deviceIds: string[],
  newPublicKey: string,
): Promise<Device[]> {
  const rotated: Device[] = [];
  for (const deviceId of deviceIds) {
    const device = await repository.getDevice(deviceId);
    if (!device) continue;
    if (device.address !== address) continue;

    const updated = await repository.updateDeviceKeyStatus(deviceId, "rotated");
    const reenrolled = await repository.createDevice(address, {
      name: device.name,
      type: device.type,
      fingerprint: device.fingerprint,
      publicKey: newPublicKey,
      lastIp: device.lastIp,
      lastLocation: device.lastLocation,
    });
    rotated.push(reenrolled);
  }
  return rotated;
}

export async function checkSuspiciousLogin(
  repository: ApiRepository,
  address: string,
  fingerprint: string,
  currentIp: string,
): Promise<{ suspicious: boolean; reason?: string }> {
  const knownDevices = await repository.listDevices(address);

  if (knownDevices.length === 0) {
    return { suspicious: false };
  }

  const matchingDevice = knownDevices.find((d) => d.fingerprint === fingerprint);
  if (!matchingDevice) {
    return { suspicious: true, reason: "unrecognized_device" };
  }

  if (matchingDevice.keyStatus === "revoked" || matchingDevice.keyStatus === "compromised") {
    return { suspicious: true, reason: "device_compromised" };
  }

  return { suspicious: false };
}

export async function getRecoveryStatus(
  repository: ApiRepository,
  address: string,
): Promise<{
  enabled: boolean;
  lastUpdated: string | null;
  devicesCount: number;
  trustedCount: number;
  recoveryMethods: RecoveryMethod[];
}> {
  const [devices, methods] = await Promise.all([
    repository.listDevices(address),
    repository.listRecoveryMethods(address),
  ]);
  return {
    enabled: methods.length > 0,
    lastUpdated:
      methods.length > 0
        ? methods.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0].createdAt
        : null,
    devicesCount: devices.length,
    trustedCount: devices.filter((d) => d.trusted).length,
    recoveryMethods: methods,
  };
}

export async function createRecoveryMethod(
  repository: ApiRepository,
  address: string,
  data: RecoveryMethodCreate,
): Promise<RecoveryMethod> {
  return repository.createRecoveryMethod(address, data);
}

export async function deleteRecoveryMethod(
  repository: ApiRepository,
  methodId: string,
  address: string,
): Promise<void> {
  const method = await repository.getRecoveryMethod(methodId);
  if (!method) throw new Error("recovery_method_not_found");
  if (method.address !== address) throw new Error("forbidden");
  await repository.deleteRecoveryMethod(methodId);
}
