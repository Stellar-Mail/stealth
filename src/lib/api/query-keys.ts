// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — query keys + cache invalidation rules.
//
// Centralizes every React Query key so hooks and mutations share one cache
// namespace, and documents which mutation invalidates which queries. The
// factory returns plain tuples (never created inside render) so cache
// invalidation stays predictable.
// ---------------------------------------------------------------------------

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    session: ["auth", "session"] as const,
  },
  identity: {
    all: ["identity"] as const,
    profile: (owner: string) => ["identity", "profile", owner] as const,
    keys: (owner: string) => ["identity", "keys", owner] as const,
  },
  mailbox: {
    all: ["mailbox"] as const,
    queue: (owner: string) => ["mailbox", "queue", owner] as const,
    message: (messageId: string) => ["mailbox", "message", messageId] as const,
  },
  requests: {
    all: ["requests"] as const,
    list: (owner: string) => ["requests", owner] as const,
  },
  policies: {
    all: ["policies"] as const,
    policy: (owner: string) => ["policies", owner] as const,
    evaluate: (owner: string) => ["policies", "evaluate", owner] as const,
  },
  postage: {
    all: ["postage"] as const,
    quote: (recipient: string, sender: string) => ["postage", "quote", recipient, sender] as const,
    byMessage: (messageId: string) => ["postage", "message", messageId] as const,
  },
  receipts: {
    all: ["receipts"] as const,
    byMessage: (messageId: string) => ["receipts", messageId] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    list: (owner: string) => ["contacts", owner] as const,
    detail: (owner: string, contactId: string) => ["contacts", owner, contactId] as const,
  },
  settings: {
    all: ["settings"] as const,
  },
  wallet: {
    all: ["wallet"] as const,
    status: ["wallet", "status"] as const,
  },
} as const;

/** Mutation → query invalidation map. Extend as new mutations are added. */
export const cacheInvalidations = {
  sessionLogout: () => [queryKeys.auth.session],
  sessionRenew: () => [queryKeys.auth.session],
  updateMailboxPolicy: (owner: string) => [
    queryKeys.policies.policy(owner),
    queryKeys.policies.evaluate(owner),
    queryKeys.settings.all,
  ],
  senderRequestDecision: (owner: string) => [
    queryKeys.requests.list(owner),
    queryKeys.mailbox.queue(owner),
  ],
  createSenderRequest: (owner: string) => [queryKeys.requests.list(owner)],
  tombstoneMessage: (owner: string) => [queryKeys.mailbox.queue(owner)],
  rotateKey: (owner: string) => [queryKeys.identity.keys(owner)],
  createContact: (owner: string) => [queryKeys.contacts.list(owner)],
  updateContact: (owner: string, contactId: string) => [
    queryKeys.contacts.list(owner),
    queryKeys.contacts.detail(owner, contactId),
  ],
  deleteContact: (owner: string) => [queryKeys.contacts.list(owner)],
} as const;
