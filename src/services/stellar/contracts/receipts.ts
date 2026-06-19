// AUTO-GENERATED — do not edit by hand.
// Source: contracts/soroban/receipts/spec.json
// Regenerate: npm run generate:bindings

import { contract } from "@stellar/stellar-sdk";

export interface Receipt {
  message_id: Buffer;
  payload_hash: Buffer;
  protocol_version: number;
  sender: string;
  recipient: string;
  delivered_at: bigint;
  read_at?: bigint;
}

export enum ReceiptsError {
  DuplicateReceipt = 1,
  ReceiptNotFound = 2,
  AlreadyRead = 3,
  CommitmentMismatch = 4,
}

// Embedded XDR spec entries derived from spec.json
const SPEC_ENTRIES: string[] = [
  "AAAAAQAAAAAAAAAAAAAAB1JlY2VpcHQAAAAABwAAAAAAAAAKbWVzc2FnZV9pZAAAAAAD7gAAACAAAAAAAAAADHBheWxvYWRfaGFzaAAAA+4AAAAgAAAAAAAAABBwcm90b2NvbF92ZXJzaW9uAAAABAAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAxkZWxpdmVyZWRfYXQAAAAGAAAAAAAAAAdyZWFkX2F0AAAAA+gAAAAG",
  "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABAAAAAAAAAAQRHVwbGljYXRlUmVjZWlwdAAAAAEAAAAAAAAAD1JlY2VpcHROb3RGb3VuZAAAAAACAAAAAAAAAAtBbHJlYWR5UmVhZAAAAAADAAAAAAAAABJDb21taXRtZW50TWlzbWF0Y2gAAAAAAAQ=",
  "AAAAAAAAAAAAAAAJZGVsaXZlcmVkAAAAAAAABQAAAAAAAAAKbWVzc2FnZV9pZAAAAAAD7gAAACAAAAAAAAAADHBheWxvYWRfaGFzaAAAA+4AAAAgAAAAAAAAABBwcm90b2NvbF92ZXJzaW9uAAAABAAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAQAAA+kAAAfQAAAAB1JlY2VpcHQAAAAH0AAAAAVFcnJvcgAAAA==",
  "AAAAAAAAAAAAAAAEcmVhZAAAAAEAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAQAAA+kAAAfQAAAAB1JlY2VpcHQAAAAH0AAAAAVFcnJvcgAAAA==",
  "AAAAAAAAAAAAAAADZ2V0AAAAAAEAAAAAAAAACm1lc3NhZ2VfaWQAAAAAA+4AAAAgAAAAAQAAA+kAAAfQAAAAB1JlY2VpcHQAAAAH0AAAAAVFcnJvcgAAAA==",
];

export interface ReceiptsClientOptions {
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
  /** Public key of the transaction source account. */
  publicKey?: string;
}

/** Map a contract error code to an actionable ReceiptsError variant. */
export function parseReceiptsError(code: number): ReceiptsError | undefined {
  return Object.values(ReceiptsError).includes(code as ReceiptsError)
    ? (code as ReceiptsError)
    : undefined;
}

/** Typed Soroban contract client for the Receipts contract. */
export function createReceiptsClient(opts: ReceiptsClientOptions): contract.Client {
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

export async function delivered(
  client: contract.Client,
  message_id: Buffer,
  payload_hash: Buffer,
  protocol_version: number,
  sender: string,
  recipient: string,
): Promise<contract.Ok<Receipt> | contract.Err<{ message: string }>> {
  const tx = await (client as any).delivered({
    message_id,
    payload_hash,
    protocol_version,
    sender,
    recipient,
  });
  return tx.result;
}

export async function read(
  client: contract.Client,
  message_id: Buffer,
): Promise<contract.Ok<Receipt> | contract.Err<{ message: string }>> {
  const tx = await (client as any).read({ message_id });
  return tx.result;
}

export async function get(
  client: contract.Client,
  message_id: Buffer,
): Promise<contract.Ok<Receipt> | contract.Err<{ message: string }>> {
  const tx = await (client as any).get({ message_id });
  return tx.result;
}
