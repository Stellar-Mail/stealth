// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — typed web data-access clients.
//
// One typed client per domain (auth, identity, mailbox, request, policy,
// postage, receipt, proof/relay, contact, settings). Each method maps to a
// server endpoint and returns typed data from the unwrapped envelope, so
// components consume interfaces rather than calling `fetch` directly.
// ---------------------------------------------------------------------------

import { ApiClient } from "./client";
import type { ApiRequestInit } from "./client";
import type {
  Contact,
  ContactCreateInput,
  ContactListResponse,
  DeliveryReceipt,
  KeyDirectoryRecord,
  LifecycleAnchorRecord,
  MailboxDescriptor,
  MailboxSealedMessage,
  MailboxCountsResponse,
  MailboxFlagsPatch,
  MailboxPolicy,
  MailboxPolicyWrite,
  MailboxQueueResponse,
  MailboxSyncResponse,
  MailboxSettings,
  PolicyReconciliation,
  PostageQuote,
  PostageRecord,
  PublicProfile,
  PublicWalletStatus,
  ReceiptRecord,
  RegistrationResponse,
  ResolvedIdentity,
  SenderRule,
  SessionBundle,
  UnknownSenderDecision,
  UnknownSenderRequest,
  UnknownSenderRequestsResponse,
  AccountInfo,
  AccountProfileResponse,
  ProfileUpdateInput,
  ProfileUpdateResponse,
} from "./types";

export interface ApiContext {
  /** Authenticated actor (Stellar G-address) when known. */
  actor: string | null;
}

export interface TypedApi {
  account: AccountClient;
  auth: AuthClient;
  identity: IdentityClient;
  mailbox: MailboxClient;
  requests: RequestsClient;
  policies: PoliciesClient;
  postage: PostageClient;
  receipts: ReceiptsClient;
  lifecycle: LifecycleClient;
  contacts: ContactsClient;
  settings: SettingsClient;
  wallet: WalletClient;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface RegistrationInput {
  displayName: string;
  email: string;
  username: string;
  password: string;
  passwordConfirmation: string;
  termsVersion: string;
  privacyPolicyVersion: string;
}

export class AuthClient {
  constructor(private readonly client: ApiClient) {}

  getSession(signal?: AbortSignal): Promise<SessionBundle> {
    return this.client.get<SessionBundle>("/auth/session", { signal });
  }

  renewSession(signal?: AbortSignal): Promise<SessionBundle> {
    return this.client.post<SessionBundle>("/auth/session", undefined, { signal });
  }

  login(input: LoginInput, signal?: AbortSignal): Promise<SessionBundle> {
    return this.client.post<SessionBundle>("/auth/login", input, { signal });
  }

  register(input: RegistrationInput, signal?: AbortSignal): Promise<RegistrationResponse> {
    return this.client.post<RegistrationResponse>("/auth/register", input, { signal });
  }

  logout(): Promise<{ success: boolean }> {
    return this.client.post<{ success: boolean }>("/auth/logout");
  }

  logoutAll(): Promise<{ success: boolean }> {
    return this.client.post<{ success: boolean }>("/auth/logout-all");
  }
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export class IdentityClient {
  constructor(private readonly client: ApiClient) {}

  getProfile(owner: string, signal?: AbortSignal): Promise<PublicProfile> {
    return this.client.get<PublicProfile>(`/identity/profile/${encodeURIComponent(owner)}`, {
      signal,
    });
  }

  getKeyDirectory(owner: string, signal?: AbortSignal): Promise<KeyDirectoryRecord> {
    return this.client.get<KeyDirectoryRecord>(`/identity/keys/${encodeURIComponent(owner)}`, {
      signal,
    });
  }

  resolve(
    identifier: string,
    options?: { timeoutMs?: number; bypassCache?: boolean },
    signal?: AbortSignal,
  ): Promise<ResolvedIdentity> {
    return this.client.post<ResolvedIdentity>(
      "/identity/resolve",
      {
        identifier,
        timeoutMs: options?.timeoutMs,
        bypassCache: options?.bypassCache,
      },
      { signal },
    );
  }
}

// ---------------------------------------------------------------------------
// Mailbox
// ---------------------------------------------------------------------------

export interface MailboxQueueQuery {
  status?: "pending" | "delivered" | "all";
  includeTombstones?: boolean;
  cursor?: string;
  limit?: number;
}

export interface MailboxSyncQuery {
  sinceCursor?: string;
  cursor?: string;
  limit?: number;
}

export class MailboxClient {
  constructor(private readonly client: ApiClient) {}

  listQueue(query: MailboxQueueQuery = {}, signal?: AbortSignal): Promise<MailboxQueueResponse> {
    return this.client.get<MailboxQueueResponse>("/mailbox/queue", {
      query: {
        status: query.status ?? "all",
        includeTombstones: query.includeTombstones,
        cursor: query.cursor,
        limit: query.limit,
      },
      signal,
    });
  }

  sync(query: MailboxSyncQuery = {}, signal?: AbortSignal): Promise<MailboxSyncResponse> {
    return this.client.get<MailboxSyncResponse>("/mailbox/sync", {
      query: {
        sinceCursor: query.sinceCursor,
        cursor: query.cursor,
        limit: query.limit,
      },
      signal,
    });
  }

  getCounts(signal?: AbortSignal): Promise<MailboxCountsResponse> {
    return this.client.get<MailboxCountsResponse>("/mailbox/counts", { signal });
  }

  patchFlags(
    messageId: string,
    patch: MailboxFlagsPatch,
    signal?: AbortSignal,
  ): Promise<MailboxDescriptor> {
    return this.client.patch<MailboxDescriptor>(
      `/mailbox/${encodeURIComponent(messageId)}`,
      patch,
      { signal },
    );
  }

  tombstone(
    messageId: string,
    signal?: AbortSignal,
  ): Promise<{ messageId: string; tombstoned: boolean }> {
    return this.client.delete(`/mailbox/${encodeURIComponent(messageId)}`, { signal });
  }

  getMessage(messageId: string, signal?: AbortSignal): Promise<MailboxSealedMessage> {
    return this.client.get<MailboxSealedMessage>(`/mailbox/${encodeURIComponent(messageId)}`, {
      signal,
    });
  }
}

// ---------------------------------------------------------------------------
// Sender requests
// ---------------------------------------------------------------------------

export class RequestsClient {
  constructor(private readonly client: ApiClient) {}

  list(
    query?: { cursor?: string; limit?: number },
    signal?: AbortSignal,
  ): Promise<UnknownSenderRequestsResponse> {
    return this.client.get<UnknownSenderRequestsResponse>("/requests", { query, signal });
  }

  decide(
    requestId: string,
    decision: UnknownSenderDecision,
    signal?: AbortSignal,
  ): Promise<UnknownSenderRequest> {
    return this.client.post(
      `/requests/${encodeURIComponent(requestId)}/decisions`,
      { decision },
      { signal },
    );
  }
}

// ---------------------------------------------------------------------------
// Mailbox policies
// ---------------------------------------------------------------------------

export class PoliciesClient {
  constructor(private readonly client: ApiClient) {}

  get(owner: string, signal?: AbortSignal): Promise<MailboxPolicy> {
    return this.client.get<MailboxPolicy>(`/policies/${encodeURIComponent(owner)}`, { signal });
  }

  update(owner: string, policy: MailboxPolicyWrite, signal?: AbortSignal): Promise<MailboxPolicy> {
    return this.client.put(`/policies/${encodeURIComponent(owner)}`, policy, { signal });
  }

  getReconciliation(
    owner: string,
    chainVersion?: number,
    signal?: AbortSignal,
  ): Promise<PolicyReconciliation> {
    return this.client.get<PolicyReconciliation>(
      `/policies/${encodeURIComponent(owner)}/reconciliation`,
      {
        query: chainVersion !== undefined ? { chainVersion: String(chainVersion) } : undefined,
        signal,
      },
    );
  }

  getRule(
    owner: string,
    sender: string,
    signal?: AbortSignal,
  ): Promise<{ owner: string; rule: SenderRule }> {
    return this.client.get<{ owner: string; rule: SenderRule }>(
      `/policies/${encodeURIComponent(owner)}/senders/${encodeURIComponent(sender)}`,
      { signal },
    );
  }

  setRule(
    owner: string,
    sender: string,
    rule: SenderRule,
    signal?: AbortSignal,
  ): Promise<{ owner: string; rule: SenderRule }> {
    return this.client.put(
      `/policies/${encodeURIComponent(owner)}/senders/${encodeURIComponent(sender)}`,
      { rule },
      { signal },
    );
  }
}

// ---------------------------------------------------------------------------
// Postage
// ---------------------------------------------------------------------------

export interface PostageQuoteQuery {
  recipient: string;
  sender: string;
  messageId?: string;
}

export class PostageClient {
  constructor(private readonly client: ApiClient) {}

  quote(query: PostageQuoteQuery, signal?: AbortSignal): Promise<PostageQuote> {
    return this.client.post<PostageQuote>("/postage/quote", query, { signal });
  }

  get(messageId: string, signal?: AbortSignal): Promise<PostageRecord> {
    return this.client.get<PostageRecord>(`/postage/${encodeURIComponent(messageId)}`, { signal });
  }

  settle(messageId: string, signal?: AbortSignal): Promise<PostageRecord> {
    return this.client.post<PostageRecord>(
      `/postage/${encodeURIComponent(messageId)}/settle`,
      undefined,
      { signal },
    );
  }

  refund(messageId: string, signal?: AbortSignal): Promise<PostageRecord> {
    return this.client.post<PostageRecord>(
      `/postage/${encodeURIComponent(messageId)}/refund`,
      undefined,
      { signal },
    );
  }

  dispute(messageId: string, signal?: AbortSignal): Promise<PostageRecord> {
    return this.client.post<PostageRecord>(
      `/postage/${encodeURIComponent(messageId)}/dispute`,
      undefined,
      { signal },
    );
  }

  expire(messageId: string, signal?: AbortSignal): Promise<PostageRecord> {
    return this.client.post<PostageRecord>(
      `/postage/${encodeURIComponent(messageId)}/expire`,
      undefined,
      { signal },
    );
  }

  reclaim(messageId: string, signal?: AbortSignal): Promise<PostageRecord> {
    return this.client.post<PostageRecord>(
      `/postage/${encodeURIComponent(messageId)}/reclaim`,
      undefined,
      { signal },
    );
  }
}

// ---------------------------------------------------------------------------
// Receipts & proof
// ---------------------------------------------------------------------------

export class ReceiptsClient {
  constructor(private readonly client: ApiClient) {}

  publish(input: DeliveryReceipt, signal?: AbortSignal): Promise<DeliveryReceipt> {
    return this.client.post<DeliveryReceipt>("/receipts", input, { signal });
  }

  get(messageId: string, signal?: AbortSignal): Promise<ReceiptRecord> {
    return this.client.get<ReceiptRecord>(`/receipts/${encodeURIComponent(messageId)}`, { signal });
  }

  markRead(messageId: string, signal?: AbortSignal): Promise<ReceiptRecord> {
    return this.client.post<ReceiptRecord>(
      `/receipts/${encodeURIComponent(messageId)}/read`,
      undefined,
      { signal },
    );
  }
}

// ---------------------------------------------------------------------------
// Lifecycle anchors (BETA-043)
// ---------------------------------------------------------------------------

export class LifecycleClient {
  constructor(private readonly client: ApiClient) {}

  get(messageId: string, signal?: AbortSignal): Promise<LifecycleAnchorRecord> {
    return this.client.get<LifecycleAnchorRecord>(`/lifecycle/${encodeURIComponent(messageId)}`, {
      signal,
    });
  }
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface ContactListQuery {
  query?: string;
  limit?: number;
  cursor?: string;
}

export class ContactsClient {
  constructor(private readonly client: ApiClient) {}

  list(query: ContactListQuery = {}, signal?: AbortSignal): Promise<ContactListResponse> {
    return this.client.get<ContactListResponse>("/contacts", {
      query: { query: query.query, limit: query.limit, cursor: query.cursor },
      signal,
    });
  }

  create(input: ContactCreateInput, signal?: AbortSignal): Promise<Contact> {
    return this.client.post<Contact>("/contacts", input, { signal });
  }
}

// ---------------------------------------------------------------------------
// Settings (mailbox policy surface used by the app shell)
// ---------------------------------------------------------------------------

export class SettingsClient {
  constructor(
    private readonly client: ApiClient,
    private readonly policies: PoliciesClient,
  ) {}

  async read(owner: string, signal?: AbortSignal): Promise<MailboxSettings> {
    const policy = await this.policies.get(owner, signal);
    return { policy, requireReceipt: false };
  }

  update(owner: string, policy: MailboxPolicyWrite, signal?: AbortSignal): Promise<MailboxPolicy> {
    return this.policies.update(owner, policy, signal);
  }
}

// ---------------------------------------------------------------------------
// BETA-069 — Account Profile & Settings
// ---------------------------------------------------------------------------

export class AccountClient {
  constructor(private readonly client: ApiClient) {}

  getProfile(signal?: AbortSignal): Promise<AccountProfileResponse> {
    return this.client.get<AccountProfileResponse>("/accounts/profile", { signal });
  }

  updateProfile(input: ProfileUpdateInput, signal?: AbortSignal): Promise<ProfileUpdateResponse> {
    return this.client.patch<ProfileUpdateResponse>("/accounts/profile", input, { signal });
  }

  getAccountInfo(signal?: AbortSignal): Promise<{ account: AccountInfo }> {
    return this.client.get<{ account: AccountInfo }>("/accounts/account-info", { signal });
  }
}

// ---------------------------------------------------------------------------
// BETA-019 — managed wallet status (owner-only, no custody fields)
// ---------------------------------------------------------------------------

export class WalletClient {
  constructor(private readonly client: ApiClient) {}

  getStatus(address?: string, signal?: AbortSignal): Promise<PublicWalletStatus> {
    return this.client.get<PublicWalletStatus>("/wallet/status", {
      query: { address },
      signal,
    });
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateTypedApiOptions {
  basePath?: string;
  correlationId?: string;
  onUnauthorized?: () => void;
}

export function createTypedApi(options: CreateTypedApiOptions = {}): TypedApi {
  const client = new ApiClient(options);
  const policies = new PoliciesClient(client);
  return {
    account: new AccountClient(client),
    auth: new AuthClient(client),
    identity: new IdentityClient(client),
    mailbox: new MailboxClient(client),
    requests: new RequestsClient(client),
    policies,
    postage: new PostageClient(client),
    receipts: new ReceiptsClient(client),
    lifecycle: new LifecycleClient(client),
    contacts: new ContactsClient(client),
    settings: new SettingsClient(client, policies),
    wallet: new WalletClient(client),
  };
}

/**
 * Shared client for the default origin. Hooks use this so every query/mutation
 * shares one transport instead of allocating a client per render.
 */
export const sharedTypedApi: TypedApi = createTypedApi();

export type { ApiRequestInit };
