// AUTO-GENERATED — do not edit by hand.
// Source: contracts/soroban/lifecycle/spec.json
// Regenerate: npm run generate:bindings

import { contract, Keypair } from "@stellar/stellar-sdk";

export interface LifecycleConfig {
  policies: string;
  postage: string;
  receipts: string;
}

export interface Postage {
  amount: bigint;
  created_at: bigint;
  dispute_until: bigint;
  expires_at: bigint;
  fee: bigint;
  recipient: string;
  sender: string;
  status: PostageStatus;
}

export interface ReceiptState {
  delivered_at: bigint;
  message_id: Buffer;
  payload_hash: Buffer;
  protocol_version: number;
  read_at?: bigint;
  recipient: string;
  sender: string;
}

export interface LifecycleRecord {
  amount: bigint;
  bound_at: bigint;
  decision_reason: PolicyReason;
  delivered_at?: bigint;
  message_id: Buffer;
  owner: string;
  payload_hash?: Buffer;
  policy_version: number;
  protocol_version?: number;
  read_at?: bigint;
  receipt_required: boolean;
  recipient: string;
  sender: string;
  terminal: LifecycleTerminal;
  verified: boolean;
}

export enum PostageStatus {
  Pending = 0,
  Expired = 1,
  Disputed = 2,
  Settled = 3,
  Refunded = 4,
  Reclaimed = 5,
}

export enum LifecycleTerminal {
  Open = 0,
  Delivered = 1,
  Read = 2,
  Settled = 3,
  Refunded = 4,
  Disputed = 5,
  Expired = 6,
  Reclaimed = 7,
}

export enum PolicyReason {
  SenderAllowed = 0,
  SenderBlocked = 1,
  UnknownSendersDisabled = 2,
  VerificationRequired = 3,
  ReceiptRequired = 4,
  InsufficientPostage = 5,
  PolicySatisfied = 6,
  TierSatisfied = 7,
}

export enum LifecycleError {
  AlreadyInitialized = 1,
  NotInitialized = 2,
  UnauthorizedContract = 3,
  PolicyRejected = 4,
  PolicyVersionMismatch = 5,
  PostageMismatch = 6,
  ReceiptMismatch = 7,
  MissingLifecycle = 8,
  TerminalStateMismatch = 9,
  DuplicateLifecycle = 10,
  AlreadyDelivered = 11,
  AlreadyRead = 12,
}

// Embedded XDR spec entries derived from spec.json
const SPEC_ENTRIES: string[] = [
  "AAAAAQAAAAAAAAAAAAAAD0xpZmVjeWNsZUNvbmZpZwAAAAADAAAAAAAAAAhwb2xpY2llcwAAABMAAAAAAAAAB3Bvc3RhZ2UAAAAAEwAAAAAAAAAIcmVjZWlwdHMAAAAT",
  "AAAAAQAAAAAAAAAAAAAAB1Bvc3RhZ2UAAAAACAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAA1kaXNwdXRlX3VudGlsAAAAAAAABgAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAAAAAADZmVlAAAAAAsAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADVBvc3RhZ2VTdGF0dXMAAAA=",
  "AAAAAQAAAAAAAAAAAAAADFJlY2VpcHRTdGF0ZQAAAAcAAAAAAAAADGRlbGl2ZXJlZF9hdAAAAAYAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAAAAAAxwYXlsb2FkX2hhc2gAAAPuAAAAIAAAAAAAAAAQcHJvdG9jb2xfdmVyc2lvbgAAAAQAAAAAAAAAB3JlYWRfYXQAAAAD6AAAAAYAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAABnNlbmRlcgAAAAAAEw==",
  "AAAAAQAAAAAAAAAAAAAAD0xpZmVjeWNsZVJlY29yZAAAAAAPAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACGJvdW5kX2F0AAAABgAAAAAAAAAPZGVjaXNpb25fcmVhc29uAAAAB9AAAAAMUG9saWN5UmVhc29uAAAAAAAAAAxkZWxpdmVyZWRfYXQAAAPoAAAABgAAAAAAAAAKbWVzc2FnZV9pZAAAAAAD7gAAACAAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAMcGF5bG9hZF9oYXNoAAAD6AAAA+4AAAAgAAAAAAAAAA5wb2xpY3lfdmVyc2lvbgAAAAAABAAAAAAAAAAQcHJvdG9jb2xfdmVyc2lvbgAAA+gAAAAEAAAAAAAAAAdyZWFkX2F0AAAAA+gAAAAGAAAAAAAAABByZWNlaXB0X3JlcXVpcmVkAAAAAQAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAh0ZXJtaW5hbAAAB9AAAAARTGlmZWN5Y2xlVGVybWluYWwAAAAAAAAAAAAACHZlcmlmaWVkAAAAAQ==",
  "AAAAAwAAAAAAAAAAAAAADVBvc3RhZ2VTdGF0dXMAAAAAAAAGAAAAAAAAAAdQZW5kaW5nAAAAAAAAAAAAAAAAB0V4cGlyZWQAAAAAAQAAAAAAAAAIRGlzcHV0ZWQAAAACAAAAAAAAAAdTZXR0bGVkAAAAAAMAAAAAAAAACFJlZnVuZGVkAAAABAAAAAAAAAAJUmVjbGFpbWVkAAAAAAAABQ==",
  "AAAAAwAAAAAAAAAAAAAAEUxpZmVjeWNsZVRlcm1pbmFsAAAAAAAACAAAAAAAAAAET3BlbgAAAAAAAAAAAAAACURlbGl2ZXJlZAAAAAAAAAEAAAAAAAAABFJlYWQAAAACAAAAAAAAAAdTZXR0bGVkAAAAAAMAAAAAAAAACFJlZnVuZGVkAAAABAAAAAAAAAAIRGlzcHV0ZWQAAAAFAAAAAAAAAAdFeHBpcmVkAAAAAAYAAAAAAAAACVJlY2xhaW1lZAAAAAAAAAc=",
  "AAAAAwAAAAAAAAAAAAAADFBvbGljeVJlYXNvbgAAAAgAAAAAAAAADVNlbmRlckFsbG93ZWQAAAAAAAAAAAAAAAAAAA1TZW5kZXJCbG9ja2VkAAAAAAAAAQAAAAAAAAAWVW5rbm93blNlbmRlcnNEaXNhYmxlZAAAAAAAAgAAAAAAAAAUVmVyaWZpY2F0aW9uUmVxdWlyZWQAAAADAAAAAAAAAA9SZWNlaXB0UmVxdWlyZWQAAAAABAAAAAAAAAATSW5zdWZmaWNpZW50UG9zdGFnZQAAAAAFAAAAAAAAAA9Qb2xpY3lTYXRpc2ZpZWQAAAAABgAAAAAAAAANVGllclNhdGlzZmllZAAAAAAAAAc=",
  "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADAAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAUVW5hdXRob3JpemVkQ29udHJhY3QAAAADAAAAAAAAAA5Qb2xpY3lSZWplY3RlZAAAAAAABAAAAAAAAAAVUG9saWN5VmVyc2lvbk1pc21hdGNoAAAAAAAABQAAAAAAAAAPUG9zdGFnZU1pc21hdGNoAAAAAAYAAAAAAAAAD1JlY2VpcHRNaXNtYXRjaAAAAAAHAAAAAAAAABBNaXNzaW5nTGlmZWN5Y2xlAAAACAAAAAAAAAAVVGVybWluYWxTdGF0ZU1pc21hdGNoAAAAAAAACQAAAAAAAAASRHVwbGljYXRlTGlmZWN5Y2xlAAAAAAAKAAAAAAAAABBBbHJlYWR5RGVsaXZlcmVkAAAACwAAAAAAAAALQWxyZWFkeVJlYWQAAAAADA==",
  "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAwAAAAAAAAAIcG9saWNpZXMAAAATAAAAAAAAAAdwb3N0YWdlAAAAABMAAAAAAAAACHJlY2VpcHRzAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAGY29uZmlnAAAAAAAAAAAAAQAAA+kAAAfQAAAAD0xpZmVjeWNsZUNvbmZpZwAAAAfQAAAABUVycm9yAAAA",
  "AAAAAAAAAAAAAAAEYmluZAAAAAcAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAh2ZXJpZmllZAAAAAEAAAAAAAAAEHJlY2VpcHRfcmVxdWlyZWQAAAABAAAAAQAAA+kAAAfQAAAAD0xpZmVjeWNsZVJlY29yZAAAAAfQAAAABUVycm9yAAAA",
  "AAAAAAAAAAAAAAANdmVyaWZ5X3NldHRsZQAAAAAAAAIAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAAAAAAdwb3N0YWdlAAAAB9AAAAAHUG9zdGFnZQAAAAABAAAD6QAAB9AAAAAPTGlmZWN5Y2xlUmVjb3JkAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAANdmVyaWZ5X3JlZnVuZAAAAAAAAAIAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAAAAAAdwb3N0YWdlAAAAB9AAAAAHUG9zdGFnZQAAAAABAAAD6QAAB9AAAAAPTGlmZWN5Y2xlUmVjb3JkAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAOdmVyaWZ5X2Rpc3B1dGUAAAAAAAIAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAAAAAAdwb3N0YWdlAAAAB9AAAAAHUG9zdGFnZQAAAAABAAAD6QAAB9AAAAAPTGlmZWN5Y2xlUmVjb3JkAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAANdmVyaWZ5X2V4cGlyZQAAAAAAAAIAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAAAAAAdwb3N0YWdlAAAAB9AAAAAHUG9zdGFnZQAAAAABAAAD6QAAB9AAAAAPTGlmZWN5Y2xlUmVjb3JkAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAOdmVyaWZ5X3JlY2xhaW0AAAAAAAIAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAAAAAAdwb3N0YWdlAAAAB9AAAAAHUG9zdGFnZQAAAAABAAAD6QAAB9AAAAAPTGlmZWN5Y2xlUmVjb3JkAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAQdmVyaWZ5X2RlbGl2ZXJlZAAAAAIAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAAAAAAdyZWNlaXB0AAAAB9AAAAAMUmVjZWlwdFN0YXRlAAAAAQAAA+kAAAfQAAAAD0xpZmVjeWNsZVJlY29yZAAAAAfQAAAABUVycm9yAAAA",
  "AAAAAAAAAAAAAAALdmVyaWZ5X3JlYWQAAAAAAgAAAAAAAAAKbWVzc2FnZV9pZAAAAAAD7gAAACAAAAAAAAAAB3JlY2VpcHQAAAAH0AAAAAxSZWNlaXB0U3RhdGUAAAABAAAD6QAAB9AAAAAPTGlmZWN5Y2xlUmVjb3JkAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAADZ2V0AAAAAAEAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAQAAA+kAAAfQAAAAD0xpZmVjeWNsZVJlY29yZAAAAAfQAAAABUVycm9yAAAA",
];

export interface LifecycleClientOptions {
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
  /** Public key of the transaction source account. */
  publicKey?: string;
  /** Secret seed of the signing keypair (e.g. the operator keypair). */
  signer?: string;
}

/** Map a contract error code to an actionable LifecycleError variant. */
export function parseLifecycleError(code: number): LifecycleError | undefined {
  return Object.values(LifecycleError).includes(code as LifecycleError)
    ? (code as LifecycleError)
    : undefined;
}

/** Typed Soroban contract client for the Lifecycle contract. */
export function createLifecycleClient(opts: LifecycleClientOptions): contract.Client {
  return new contract.Client(new contract.Spec(SPEC_ENTRIES), {
    contractId: opts.contractId,
    networkPassphrase: opts.networkPassphrase,
    rpcUrl: opts.rpcUrl,
    ...(opts.publicKey ? { publicKey: opts.publicKey } : {}),
    ...(opts.signer ? { signTransaction: Keypair.fromSecret(opts.signer) } : {}),
  });
}

// ---------------------------------------------------------------------------
// Typed call helpers
// These wrap contract.Client to provide typed args and return values.
// For Result-returning methods, call .isOk() / .isErr() on the return value.
// Use the contract Error enum to identify specific errors via .unwrapErr().message.
// ---------------------------------------------------------------------------

export async function initialize(
  client: contract.Client,
  policies: string,
  postage: string,
  receipts: string,
): Promise<contract.Ok<void> | contract.Err<{ message: string }>> {
  const tx = await (client as any).initialize({ policies, postage, receipts });
  return tx.result;
}

export async function config(
  client: contract.Client,
): Promise<contract.Ok<LifecycleConfig> | contract.Err<{ message: string }>> {
  const tx = await (client as any).config({});
  return tx.result;
}

export async function bind(
  client: contract.Client,
  message_id: Buffer,
  owner: string,
  sender: string,
  recipient: string,
  amount: bigint,
  verified: boolean,
  receipt_required: boolean,
): Promise<contract.Ok<LifecycleRecord> | contract.Err<{ message: string }>> {
  const tx = await (client as any).bind({
    message_id,
    owner,
    sender,
    recipient,
    amount,
    verified,
    receipt_required,
  });
  return tx.result;
}

export async function verifySettle(
  client: contract.Client,
  message_id: Buffer,
  postage: Postage,
): Promise<contract.Ok<LifecycleRecord> | contract.Err<{ message: string }>> {
  const tx = await (client as any).verify_settle({ message_id, postage });
  return tx.result;
}

export async function verifyRefund(
  client: contract.Client,
  message_id: Buffer,
  postage: Postage,
): Promise<contract.Ok<LifecycleRecord> | contract.Err<{ message: string }>> {
  const tx = await (client as any).verify_refund({ message_id, postage });
  return tx.result;
}

export async function verifyDispute(
  client: contract.Client,
  message_id: Buffer,
  postage: Postage,
): Promise<contract.Ok<LifecycleRecord> | contract.Err<{ message: string }>> {
  const tx = await (client as any).verify_dispute({ message_id, postage });
  return tx.result;
}

export async function verifyExpire(
  client: contract.Client,
  message_id: Buffer,
  postage: Postage,
): Promise<contract.Ok<LifecycleRecord> | contract.Err<{ message: string }>> {
  const tx = await (client as any).verify_expire({ message_id, postage });
  return tx.result;
}

export async function verifyReclaim(
  client: contract.Client,
  message_id: Buffer,
  postage: Postage,
): Promise<contract.Ok<LifecycleRecord> | contract.Err<{ message: string }>> {
  const tx = await (client as any).verify_reclaim({ message_id, postage });
  return tx.result;
}

export async function verifyDelivered(
  client: contract.Client,
  message_id: Buffer,
  receipt: ReceiptState,
): Promise<contract.Ok<LifecycleRecord> | contract.Err<{ message: string }>> {
  const tx = await (client as any).verify_delivered({ message_id, receipt });
  return tx.result;
}

export async function verifyRead(
  client: contract.Client,
  message_id: Buffer,
  receipt: ReceiptState,
): Promise<contract.Ok<LifecycleRecord> | contract.Err<{ message: string }>> {
  const tx = await (client as any).verify_read({ message_id, receipt });
  return tx.result;
}

export async function get(
  client: contract.Client,
  message_id: Buffer,
): Promise<contract.Ok<LifecycleRecord> | contract.Err<{ message: string }>> {
  const tx = await (client as any).get({ message_id });
  return tx.result;
}
