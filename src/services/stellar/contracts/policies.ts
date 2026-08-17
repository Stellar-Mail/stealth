// AUTO-GENERATED — do not edit by hand.
// Source: contracts/soroban/policies/spec.json
// Regenerate: npm run generate:bindings

import { contract } from "@stellar/stellar-sdk";

export interface MailboxPolicy {
  allow_unknown: boolean;
  require_verified: boolean;
  require_receipt: boolean;
  minimum_postage: bigint;
}

export interface VersionedMailboxPolicy {
  policy: MailboxPolicy;
  version: number;
}

export interface DelegateScope {
  can_set_policy: boolean;
  can_set_senders: boolean;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: PolicyReason;
  required_postage: bigint;
  rule: SenderRule;
  version: number;
}

export enum SenderRule {
  Default = 0,
  Allow = 1,
  Block = 2,
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

export enum PoliciesError {
  InvalidPostage = 1,
  UnauthorizedDelegate = 2,
}

// Embedded XDR spec entries derived from spec.json
const SPEC_ENTRIES: string[] = [
  "AAAAAQAAAAAAAAAAAAAADU1haWxib3hQb2xpY3kAAAAAAAAEAAAAAAAAAA1hbGxvd191bmtub3duAAAAAAAAAQAAAAAAAAAQcmVxdWlyZV92ZXJpZmllZAAAAAEAAAAAAAAAD3JlcXVpcmVfcmVjZWlwdAAAAAABAAAAAAAAAA9taW5pbXVtX3Bvc3RhZ2UAAAAACw==",
  "AAAAAQAAAAAAAAAAAAAAFlZlcnNpb25lZE1haWxib3hQb2xpY3kAAAAAAAIAAAAAAAAABnBvbGljeQAAAAAH0AAAAA1NYWlsYm94UG9saWN5AAAAAAAAAAAAAAd2ZXJzaW9uAAAAAAQ=",
  "AAAAAQAAAAAAAAAAAAAADURlbGVnYXRlU2NvcGUAAAAAAAACAAAAAAAAAA5jYW5fc2V0X3BvbGljeQAAAAAAAQAAAAAAAAAPY2FuX3NldF9zZW5kZXJzAAAAAAE=",
  "AAAAAQAAAAAAAAAAAAAADlBvbGljeURlY2lzaW9uAAAAAAAFAAAAAAAAAAdhbGxvd2VkAAAAAAEAAAAAAAAABnJlYXNvbgAAAAAH0AAAAAxQb2xpY3lSZWFzb24AAAAAAAAAEHJlcXVpcmVkX3Bvc3RhZ2UAAAALAAAAAAAAAARydWxlAAAH0AAAAApTZW5kZXJSdWxlAAAAAAAAAAAAB3ZlcnNpb24AAAAABA==",
  "AAAAAwAAAAAAAAAAAAAAClNlbmRlclJ1bGUAAAAAAAMAAAAAAAAAB0RlZmF1bHQAAAAAAAAAAAAAAAAFQWxsb3cAAAAAAAABAAAAAAAAAAVCbG9jawAAAAAAAAI=",
  "AAAAAwAAAAAAAAAAAAAADFBvbGljeVJlYXNvbgAAAAgAAAAAAAAADVNlbmRlckFsbG93ZWQAAAAAAAAAAAAAAAAAAA1TZW5kZXJCbG9ja2VkAAAAAAAAAQAAAAAAAAAWVW5rbm93blNlbmRlcnNEaXNhYmxlZAAAAAAAAgAAAAAAAAAUVmVyaWZpY2F0aW9uUmVxdWlyZWQAAAADAAAAAAAAAA9SZWNlaXB0UmVxdWlyZWQAAAAABAAAAAAAAAATSW5zdWZmaWNpZW50UG9zdGFnZQAAAAAFAAAAAAAAAA9Qb2xpY3lTYXRpc2ZpZWQAAAAABgAAAAAAAAANVGllclNhdGlzZmllZAAAAAAAAAc=",
  "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAAgAAAAAAAAAOSW52YWxpZFBvc3RhZ2UAAAAAAAEAAAAAAAAAFFVuYXV0aG9yaXplZERlbGVnYXRlAAAAAg==",
  "AAAAAAAAAAAAAAAKc2V0X3BvbGljeQAAAAAAAgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAZwb2xpY3kAAAAAB9AAAAANTWFpbGJveFBvbGljeQAAAAAAAAEAAAPpAAAAAgAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAANc2V0X3BvbGljeV9hcwAAAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAFYWN0b3IAAAAAAAATAAAAAAAAAAZwb2xpY3kAAAAAB9AAAAANTWFpbGJveFBvbGljeQAAAAAAAAEAAAPpAAAAAgAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAAKZ2V0X3BvbGljeQAAAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAB9AAAAANTWFpbGJveFBvbGljeQAAAA==",
  "AAAAAAAAAAAAAAAUZ2V0X3ZlcnNpb25lZF9wb2xpY3kAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAH0AAAABZWZXJzaW9uZWRNYWlsYm94UG9saWN5AAA=",
  "AAAAAAAAAAAAAAAOcG9saWN5X3ZlcnNpb24AAAAAAAEAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAAE",
  "AAAAAAAAAAAAAAAMc2V0X2RlbGVnYXRlAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAhkZWxlZ2F0ZQAAABMAAAAAAAAABXNjb3BlAAAAAAAH0AAAAA1EZWxlZ2F0ZVNjb3BlAAAAAAAAAQAAA+kAAAACAAAH0AAAAAVFcnJvcgAAAA==",
  "AAAAAAAAAAAAAAAOZGVsZWdhdGVfc2NvcGUAAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAIZGVsZWdhdGUAAAATAAAAAQAAB9AAAAANRGVsZWdhdGVTY29wZQAAAA==",
  "AAAAAAAAAAAAAAAPc2V0X3NlbmRlcl9ydWxlAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAARydWxlAAAH0AAAAApTZW5kZXJSdWxlAAAAAAABAAAD6QAAAAIAAAfQAAAABUVycm9yAAAA",
  "AAAAAAAAAAAAAAASc2V0X3NlbmRlcl9ydWxlX2FzAAAAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABWFjdG9yAAAAAAAAEwAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAARydWxlAAAH0AAAAApTZW5kZXJSdWxlAAAAAAABAAAD6QAAAAIAAAfQAAAABUVycm9yAAAA",
  "AAAAAAAAAAAAAAAPc2V0X3NlbmRlcl90aWVyAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAA9taW5pbXVtX3Bvc3RhZ2UAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAASc2V0X3NlbmRlcl90aWVyX2FzAAAAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABWFjdG9yAAAAAAAAEwAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAA9taW5pbXVtX3Bvc3RhZ2UAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAAFRXJyb3IAAAA=",
  "AAAAAAAAAAAAAAALc2VuZGVyX3J1bGUAAAAAAgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAZzZW5kZXIAAAAAABMAAAABAAAH0AAAAApTZW5kZXJSdWxlAAA=",
  "AAAAAAAAAAAAAAALc2VuZGVyX3RpZXIAAAAAAgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAZzZW5kZXIAAAAAABMAAAABAAAD6AAAAAs=",
  "AAAAAAAAAAAAAAAIY2FuX21haWwAAAAFAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAIdmVyaWZpZWQAAAABAAAAAAAAAAdwb3N0YWdlAAAAAAsAAAAAAAAAB3JlY2VpcHQAAAAAAQAAAAEAAAAB",
  "AAAAAAAAAAAAAAAIZXZhbHVhdGUAAAAFAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAIdmVyaWZpZWQAAAABAAAAAAAAAAdwb3N0YWdlAAAAAAsAAAAAAAAAB3JlY2VpcHQAAAAAAQAAAAEAAAfQAAAADlBvbGljeURlY2lzaW9uAAA=",
];

export interface PoliciesClientOptions {
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
  /** Public key of the transaction source account. */
  publicKey?: string;
}

/** Map a contract error code to an actionable PoliciesError variant. */
export function parsePoliciesError(code: number): PoliciesError | undefined {
  return Object.values(PoliciesError).includes(code as PoliciesError)
    ? (code as PoliciesError)
    : undefined;
}

/** Typed Soroban contract client for the Policies contract. */
export function createPoliciesClient(opts: PoliciesClientOptions): contract.Client {
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

export async function setPolicy(
  client: contract.Client,
  owner: string,
  policy: MailboxPolicy,
): Promise<contract.Ok<void> | contract.Err<{ message: string }>> {
  const tx = await (client as any).set_policy({ owner, policy });
  return tx.result;
}

export async function setPolicyAs(
  client: contract.Client,
  owner: string,
  actor: string,
  policy: MailboxPolicy,
): Promise<contract.Ok<void> | contract.Err<{ message: string }>> {
  const tx = await (client as any).set_policy_as({ owner, actor, policy });
  return tx.result;
}

export async function getPolicy(client: contract.Client, owner: string): Promise<MailboxPolicy> {
  const tx = await (client as any).get_policy({ owner });
  return tx.result;
}

export async function getVersionedPolicy(
  client: contract.Client,
  owner: string,
): Promise<VersionedMailboxPolicy> {
  const tx = await (client as any).get_versioned_policy({ owner });
  return tx.result;
}

export async function policyVersion(client: contract.Client, owner: string): Promise<number> {
  const tx = await (client as any).policy_version({ owner });
  return tx.result;
}

export async function setDelegate(
  client: contract.Client,
  owner: string,
  delegate: string,
  scope: DelegateScope,
): Promise<contract.Ok<void> | contract.Err<{ message: string }>> {
  const tx = await (client as any).set_delegate({ owner, delegate, scope });
  return tx.result;
}

export async function delegateScope(
  client: contract.Client,
  owner: string,
  delegate: string,
): Promise<DelegateScope> {
  const tx = await (client as any).delegate_scope({ owner, delegate });
  return tx.result;
}

export async function setSenderRule(
  client: contract.Client,
  owner: string,
  sender: string,
  rule: SenderRule,
): Promise<contract.Ok<void> | contract.Err<{ message: string }>> {
  const tx = await (client as any).set_sender_rule({ owner, sender, rule });
  return tx.result;
}

export async function setSenderRuleAs(
  client: contract.Client,
  owner: string,
  actor: string,
  sender: string,
  rule: SenderRule,
): Promise<contract.Ok<void> | contract.Err<{ message: string }>> {
  const tx = await (client as any).set_sender_rule_as({ owner, actor, sender, rule });
  return tx.result;
}

export async function setSenderTier(
  client: contract.Client,
  owner: string,
  sender: string,
  minimum_postage: bigint,
): Promise<contract.Ok<void> | contract.Err<{ message: string }>> {
  const tx = await (client as any).set_sender_tier({ owner, sender, minimum_postage });
  return tx.result;
}

export async function setSenderTierAs(
  client: contract.Client,
  owner: string,
  actor: string,
  sender: string,
  minimum_postage: bigint,
): Promise<contract.Ok<void> | contract.Err<{ message: string }>> {
  const tx = await (client as any).set_sender_tier_as({ owner, actor, sender, minimum_postage });
  return tx.result;
}

export async function senderRule(
  client: contract.Client,
  owner: string,
  sender: string,
): Promise<SenderRule> {
  const tx = await (client as any).sender_rule({ owner, sender });
  return tx.result;
}

export async function senderTier(
  client: contract.Client,
  owner: string,
  sender: string,
): Promise<bigint | null> {
  const tx = await (client as any).sender_tier({ owner, sender });
  return tx.result;
}

export async function canMail(
  client: contract.Client,
  owner: string,
  sender: string,
  verified: boolean,
  postage: bigint,
  receipt: boolean,
): Promise<boolean> {
  const tx = await (client as any).can_mail({ owner, sender, verified, postage, receipt });
  return tx.result;
}

export async function evaluate(
  client: contract.Client,
  owner: string,
  sender: string,
  verified: boolean,
  postage: bigint,
  receipt: boolean,
): Promise<PolicyDecision> {
  const tx = await (client as any).evaluate({ owner, sender, verified, postage, receipt });
  return tx.result;
}
