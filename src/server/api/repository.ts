import type {
  Device,
  DeviceCreate,
  DeviceUpdate,
  IdempotencyRecord,
  MailboxPolicy,
  Postage,
  Receipt,
  RecoveryMethod,
  RecoveryMethodCreate,
  SenderRule,
  Session,
} from "./domain";

export interface ApiRepository {
  getPolicy(owner: string): Promise<MailboxPolicy | null>;
  setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy>;
  getSenderRule(owner: string, sender: string): Promise<SenderRule>;
  setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule>;
  getPostage(messageId: string): Promise<Postage | null>;
  setPostage(postage: Postage): Promise<Postage>;
  getReceipt(messageId: string): Promise<Receipt | null>;
  setReceipt(receipt: Receipt): Promise<Receipt>;
  getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null>;
  setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void>;

  getRelayQueueDepth(relayId: string): Promise<number>;
  getRelayRetryCount(relayId: string): Promise<number>;
  getRelayLastSuccessfulDelivery(relayId: string): Promise<string | null>;
  getRelayLastFailedDelivery(relayId: string): Promise<string | null>;
  getRelayDeadLetterCount(relayId: string): Promise<number>;
  getCounter(key: string): Promise<number>;
  incrementCounter(key: string, windowSeconds: number): Promise<number>;

  listDevices(address: string): Promise<Device[]>;
  getDevice(deviceId: string): Promise<Device | null>;
  createDevice(address: string, data: DeviceCreate): Promise<Device>;
  updateDevice(deviceId: string, data: DeviceUpdate): Promise<Device>;
  updateDeviceKeyStatus(deviceId: string, keyStatus: Device["keyStatus"]): Promise<Device>;
  deleteDevice(deviceId: string): Promise<void>;

  listSessions(address: string): Promise<Session[]>;
  getSession(sessionId: string): Promise<Session | null>;
  createSession(session: Session): Promise<Session>;
  revokeSession(sessionId: string): Promise<Session>;
  revokeAllSessionsForDevice(deviceId: string): Promise<void>;

  getDeviceByFingerprint(address: string, fingerprint: string): Promise<Device | null>;

  listRecoveryMethods(address: string): Promise<RecoveryMethod[]>;
  getRecoveryMethod(methodId: string): Promise<RecoveryMethod | null>;
  createRecoveryMethod(address: string, data: RecoveryMethodCreate): Promise<RecoveryMethod>;
  deleteRecoveryMethod(methodId: string): Promise<void>;
  testRecoveryMethod(methodId: string): Promise<RecoveryMethod>;
}

export const defaultMailboxPolicy: MailboxPolicy = {
  allowUnknown: false,
  minimumPostage: "0",
  requireVerified: true,
};
