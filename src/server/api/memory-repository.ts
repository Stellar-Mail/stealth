import type { Device, DeviceCreate, DeviceUpdate, MailboxPolicy, Postage, Receipt, RecoveryMethod, RecoveryMethodCreate, SenderRule, Session } from "./domain";
import type { ApiRepository } from "./repository";

function key(owner: string, sender: string) {
  return `${owner}:${sender}`;
}

export class MemoryApiRepository implements ApiRepository {
  private readonly policies = new Map<string, MailboxPolicy>();
  private readonly postage = new Map<string, Postage>();
  private readonly receipts = new Map<string, Receipt>();
  private readonly senderRules = new Map<string, SenderRule>();
  private readonly counters = new Map<string, number[]>();
  private readonly devices = new Map<string, Device>();
  private readonly sessions = new Map<string, Session>();
  private readonly recoveryMethods = new Map<string, RecoveryMethod>();

  async getPolicy(owner: string) {
    return structuredClone(this.policies.get(owner) ?? null);
  }

  async setPolicy(owner: string, policy: MailboxPolicy) {
    this.policies.set(owner, structuredClone(policy));
    return structuredClone(policy);
  }

  async getSenderRule(owner: string, sender: string) {
    return this.senderRules.get(key(owner, sender)) ?? "default";
  }

  async setSenderRule(owner: string, sender: string, rule: SenderRule) {
    const ruleKey = key(owner, sender);
    if (rule === "default") this.senderRules.delete(ruleKey);
    else this.senderRules.set(ruleKey, rule);
    return rule;
  }

  async getPostage(messageId: string) {
    return structuredClone(this.postage.get(messageId) ?? null);
  }

  async setPostage(postage: Postage) {
    this.postage.set(postage.messageId, structuredClone(postage));
    return structuredClone(postage);
  }

  async getReceipt(messageId: string) {
    return structuredClone(this.receipts.get(messageId) ?? null);
  }

  async setReceipt(receipt: Receipt) {
    this.receipts.set(receipt.messageId, structuredClone(receipt));
    return structuredClone(receipt);
  }

  async getRelayQueueDepth(_relayId: string) {
    return 0;
  }

  async getRelayRetryCount(_relayId: string) {
    return 0;
  }

  async getRelayLastSuccessfulDelivery(_relayId: string) {
    return null;
  }

  async getRelayLastFailedDelivery(_relayId: string) {
    return null;
  }

  async getRelayDeadLetterCount(_relayId: string) {
    return 0;
  }
  async getCounter(key: string) {
    return this.counters.get(key)?.length ?? 0;
  }

  async listDevices(address: string) {
    return Array.from(this.devices.values())
      .filter((d) => d.address === address)
      .sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
  }

  async getDevice(deviceId: string) {
    return structuredClone(this.devices.get(deviceId) ?? null);
  }

  async createDevice(address: string, data: DeviceCreate) {
    const device: Device = {
      id: crypto.randomUUID(),
      address,
      name: data.name,
      type: data.type,
      fingerprint: data.fingerprint,
      publicKey: data.publicKey,
      keyStatus: "active",
      trusted: false,
      lastActive: new Date().toISOString(),
      lastIp: data.lastIp,
      lastLocation: data.lastLocation,
      createdAt: new Date().toISOString(),
      isCurrent: false,
    };
    this.devices.set(device.id, device);
    return structuredClone(device);
  }

  async updateDevice(deviceId: string, data: DeviceUpdate) {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error("device_not_found");
    const updated: Device = {
      ...device,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.trusted !== undefined ? { trusted: data.trusted } : {}),
    };
    this.devices.set(deviceId, updated);
    return structuredClone(updated);
  }

  async updateDeviceKeyStatus(deviceId: string, keyStatus: Device["keyStatus"]) {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error("device_not_found");
    device.keyStatus = keyStatus;
    return structuredClone(device);
  }

  async deleteDevice(deviceId: string) {
    this.devices.delete(deviceId);
  }

  async listSessions(address: string) {
    return Array.from(this.sessions.values())
      .filter((s) => s.address === address)
      .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  async getSession(sessionId: string) {
    return structuredClone(this.sessions.get(sessionId) ?? null);
  }

  async createSession(session: Session) {
    this.sessions.set(session.id, session);
    return structuredClone(session);
  }

  async revokeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("session_not_found");
    session.revokedAt = new Date().toISOString();
    return structuredClone(session);
  }

  async revokeAllSessionsForDevice(deviceId: string) {
    for (const [id, session] of this.sessions) {
      if (session.deviceId === deviceId && !session.revokedAt) {
        session.revokedAt = new Date().toISOString();
      }
    }
  }

  async getDeviceByFingerprint(address: string, fingerprint: string) {
    const device = Array.from(this.devices.values()).find(
      (d) => d.address === address && d.fingerprint === fingerprint,
    );
    return structuredClone(device ?? null);
  }

  async listRecoveryMethods(address: string) {
    return Array.from(this.recoveryMethods.values())
      .filter((m) => m.address === address)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getRecoveryMethod(methodId: string) {
    return structuredClone(this.recoveryMethods.get(methodId) ?? null);
  }

  async createRecoveryMethod(address: string, data: RecoveryMethodCreate) {
    const method: RecoveryMethod = {
      id: crypto.randomUUID(),
      address,
      type: data.type,
      label: data.label,
      value: data.value,
      createdAt: new Date().toISOString(),
      lastTestedAt: null,
      disabled: false,
    };
    this.recoveryMethods.set(method.id, method);
    return structuredClone(method);
  }

  async deleteRecoveryMethod(methodId: string) {
    this.recoveryMethods.delete(methodId);
  }

  async testRecoveryMethod(methodId: string) {
    const method = this.recoveryMethods.get(methodId);
    if (!method) throw new Error("recovery_method_not_found");
    method.lastTestedAt = new Date().toISOString();
    return structuredClone(method);
  }

  async incrementCounter(key: string, windowSeconds: number) {
    const now = Date.now();
    const windowMilliseconds = windowSeconds * 1000;
    const timestamps = this.counters.get(key) ?? [];
    const filtered = [...timestamps, now].filter(
      (timestamp) => now - timestamp <= windowMilliseconds,
    );
    this.counters.set(key, filtered);
    return filtered.length;
  }

  reset() {
    this.policies.clear();
    this.postage.clear();
    this.receipts.clear();
    this.senderRules.clear();
    this.counters.clear();
    this.devices.clear();
    this.sessions.clear();
    this.recoveryMethods.clear();
  }
}
