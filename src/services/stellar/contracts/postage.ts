// AUTO-GENERATED — do not edit by hand.
// Source: contracts/soroban/postage/spec.json
// Regenerate: npm run generate:bindings

import { contract } from "@stellar/stellar-sdk";

export interface Postage {
  sender: string;
  recipient: string;
  amount: bigint;
  fee: bigint;
  created_at: bigint;
  expires_at: bigint;
  dispute_until: bigint;
  status: PostageStatus;
}

export interface EscrowConfig {
  asset: string;
  minimum: bigint;
  treasury: string;
  fee_bps: number;
  expiry_seconds: bigint;
  dispute_seconds: bigint;
}

export enum PostageStatus {
  Pending = 0,
  Expired = 1,
  Disputed = 2,
  Settled = 3,
  Refunded = 4,
  Reclaimed = 5,
}

export enum PostageError {
  AlreadyInitialized = 1,
  NotInitialized = 2,
  InvalidAmount = 3,
  DuplicateMessage = 4,
  PostageNotFound = 5,
  AlreadyResolved = 6,
  InvalidFee = 7,
  InvalidWindow = 8,
  NotExpired = 9,
  DisputeUnavailable = 10,
}

// Embedded XDR spec entries derived from spec.json
const SPEC_ENTRIES: string[] = [
  "AAAAAQAAAAAAAAAAAAAAB1Bvc3RhZ2UAAAAACAAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAA2ZlZQAAAAALAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAAAAAA1kaXNwdXRlX3VudGlsAAAAAAAABgAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADVBvc3RhZ2VTdGF0dXMAAAA=",
  "AAAAAQAAAAAAAAAAAAAADEVzY3Jvd0NvbmZpZwAAAAYAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAHbWluaW11bQAAAAALAAAAAAAAAAh0cmVhc3VyeQAAABMAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAAOZXhwaXJ5X3NlY29uZHMAAAAAAAYAAAAAAAAAD2Rpc3B1dGVfc2Vjb25kcwAAAAAG",
  "AAAAAwAAAAAAAAAAAAAADVBvc3RhZ2VTdGF0dXMAAAAAAAAGAAAAAAAAAAdQZW5kaW5nAAAAAAAAAAAAAAAAB0V4cGlyZWQAAAAAAQAAAAAAAAAIRGlzcHV0ZWQAAAACAAAAAAAAAAdTZXR0bGVkAAAAAAMAAAAAAAAACFJlZnVuZGVkAAAABAAAAAAAAAAJUmVjbGFpbWVkAAAAAAAABQ==",
  "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAMAAAAAAAAAEER1cGxpY2F0ZU1lc3NhZ2UAAAAEAAAAAAAAAA9Qb3N0YWdlTm90Rm91bmQAAAAABQAAAAAAAAAPQWxyZWFkeVJlc29sdmVkAAAAAAYAAAAAAAAACkludmFsaWRGZWUAAAAAAAcAAAAAAAAADUludmFsaWRXaW5kb3cAAAAAAAAIAAAAAAAAAApOb3RFeHBpcmVkAAAAAAAJAAAAAAAAABJEaXNwdXRlVW5hdmFpbGFibGUAAAAAAAo=",
  "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAABgAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAh0cmVhc3VyeQAAABMAAAAAAAAAB21pbmltdW0AAAAACwAAAAAAAAAHZmVlX2JwcwAAAAAEAAAAAAAAAA5leHBpcnlfc2Vjb25kcwAAAAAABgAAAAAAAAAPZGlzcHV0ZV9zZWNvbmRzAAAAAAYAAAABAAAD6QAAAAIAAAfQAAAABUVycm9yAAAA",
  "AAAAAAAAAAAAAAAGY29uZmlnAAAAAAAAAAAAAQAAA+kAAAfQAAAADEVzY3Jvd0NvbmZpZwAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAHbWluaW11bQAAAAAAAAAAAQAAA+kAAAALAAAH0AAAAAVFcnJvcgAAAA==",
  "AAAAAAAAAAAAAAAFcXVvdGUAAAAAAAABAAAAAAAAAA5zZW5kZXJfdHJ1c3RlZAAAAAAAAQAAAAEAAAPpAAAACwAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAGc3VibWl0AAAAAAAEAAAAAAAAAAptZXNzYWdlX2lkAAAAAAPuAAAAIAAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAB9AAAAAHUG9zdGFnZQAAAAfQAAAABUVycm9yAAAA",
  "AAAAAAAAAAAAAAAGc2V0dGxlAAAAAAABAAAAAAAAAAptZXNzYWdlX2lkAAAAAAPuAAAAIAAAAAEAAAPpAAAH0AAAAAdQb3N0YWdlAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAGcmVmdW5kAAAAAAABAAAAAAAAAAptZXNzYWdlX2lkAAAAAAPuAAAAIAAAAAEAAAPpAAAH0AAAAAdQb3N0YWdlAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAHZGlzcHV0ZQAAAAABAAAAAAAAAAptZXNzYWdlX2lkAAAAAAPuAAAAIAAAAAEAAAPpAAAH0AAAAAdQb3N0YWdlAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAGZXhwaXJlAAAAAAABAAAAAAAAAAptZXNzYWdlX2lkAAAAAAPuAAAAIAAAAAEAAAPpAAAH0AAAAAdQb3N0YWdlAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAHcmVjbGFpbQAAAAABAAAAAAAAAAptZXNzYWdlX2lkAAAAAAPuAAAAIAAAAAEAAAPpAAAH0AAAAAdQb3N0YWdlAAAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAADZ2V0AAAAAAEAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAQAAA+kAAAfQAAAAB1Bvc3RhZ2UAAAAH0AAAAAVFcnJvcgAAAA==",
];

export interface PostageClientOptions {
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
  /** Public key of the transaction source account. */
  publicKey?: string;
}

/** Map a contract error code to an actionable PostageError variant. */
export function parsePostageError(code: number): PostageError | undefined {
  return Object.values(PostageError).includes(code as PostageError)
    ? (code as PostageError)
    : undefined;
}

/** Typed Soroban contract client for the Postage contract. */
export function createPostageClient(opts: PostageClientOptions): contract.Client {
  return new contract.Client(new contract.Spec(SPEC_ENTRIES), {
    contractId: opts.contractId,
    networkPassphrase: opts.networkPassphrase,
    rpcUrl: opts.rpcUrl,
    ...(opts.publicKey ? { publicKey: opts.publicKey } : {}),
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
  asset: string,
  treasury: string,
  minimum: bigint,
  fee_bps: number,
  expiry_seconds: bigint,
  dispute_seconds: bigint,
): Promise<contract.Ok<void> | contract.Err<{ message: string }>> {
  const tx = await (client as any).initialize({
    asset,
    treasury,
    minimum,
    fee_bps,
    expiry_seconds,
    dispute_seconds,
  });
  return tx.result;
}

export async function config(
  client: contract.Client,
): Promise<contract.Ok<EscrowConfig> | contract.Err<{ message: string }>> {
  const tx = await (client as any).config({});
  return tx.result;
}

export async function minimum(
  client: contract.Client,
): Promise<contract.Ok<bigint> | contract.Err<{ message: string }>> {
  const tx = await (client as any).minimum({});
  return tx.result;
}

export async function quote(
  client: contract.Client,
  sender_trusted: boolean,
): Promise<contract.Ok<bigint> | contract.Err<{ message: string }>> {
  const tx = await (client as any).quote({ sender_trusted });
  return tx.result;
}

export async function submit(
  client: contract.Client,
  message_id: Buffer,
  sender: string,
  recipient: string,
  amount: bigint,
): Promise<contract.Ok<Postage> | contract.Err<{ message: string }>> {
  const tx = await (client as any).submit({ message_id, sender, recipient, amount });
  return tx.result;
}

export async function settle(
  client: contract.Client,
  message_id: Buffer,
): Promise<contract.Ok<Postage> | contract.Err<{ message: string }>> {
  const tx = await (client as any).settle({ message_id });
  return tx.result;
}

export async function refund(
  client: contract.Client,
  message_id: Buffer,
): Promise<contract.Ok<Postage> | contract.Err<{ message: string }>> {
  const tx = await (client as any).refund({ message_id });
  return tx.result;
}

export async function dispute(
  client: contract.Client,
  message_id: Buffer,
): Promise<contract.Ok<Postage> | contract.Err<{ message: string }>> {
  const tx = await (client as any).dispute({ message_id });
  return tx.result;
}

export async function expire(
  client: contract.Client,
  message_id: Buffer,
): Promise<contract.Ok<Postage> | contract.Err<{ message: string }>> {
  const tx = await (client as any).expire({ message_id });
  return tx.result;
}

export async function reclaim(
  client: contract.Client,
  message_id: Buffer,
): Promise<contract.Ok<Postage> | contract.Err<{ message: string }>> {
  const tx = await (client as any).reclaim({ message_id });
  return tx.result;
}

export async function get(
  client: contract.Client,
  message_id: Buffer,
): Promise<contract.Ok<Postage> | contract.Err<{ message: string }>> {
  const tx = await (client as any).get({ message_id });
  return tx.result;
}
