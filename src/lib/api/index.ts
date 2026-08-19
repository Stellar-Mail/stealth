// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — typed web data-access layer.
//
// Public surface for all typed API clients, DTOs, query keys, cache
// invalidation rules, and normalized errors. Components should import from
// here (or from `src/features/mail` hooks) and never call `fetch` directly.
// ---------------------------------------------------------------------------

export {
  ApiClient,
  ApiClientError,
  type ApiClientOptions,
  type ApiEnvelope,
  type ApiMeta,
  type ApiRequestInit,
} from "./client";
export {
  API_CLIENT_ERROR_CODES,
  errorLabel,
  isApiClientError,
  normalizeApiClientError,
  parseErrorEnvelope,
  statusToCode,
  type ApiClientErrorCode,
  type ApiRetryClassification,
} from "./errors";
export { cacheInvalidations, queryKeys } from "./query-keys";
export {
  createTypedApi,
  sharedTypedApi,
  AuthClient,
  ContactsClient,
  IdentityClient,
  MailboxClient,
  PoliciesClient,
  PostageClient,
  ReceiptsClient,
  RequestsClient,
  SettingsClient,
  WalletClient,
  type ApiContext,
  type CreateTypedApiOptions,
  type TypedApi,
} from "./clients";
export type * from "./types";
export { type MailboxQueueQuery, type PostageQuoteQuery, type ContactListQuery } from "./clients";
