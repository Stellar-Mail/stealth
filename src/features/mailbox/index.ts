export type {
  Message,
  Thread,
  Contact,
  Policy,
  Proof,
  SyncCursor,
  MailboxState,
  LoadingState,
  MailboxContext,
  MailFolder,
  MailLocation,
  MailFilters,
} from "./types";

export type { IMailboxRepository } from "./repository";

export { MemoryMailboxAdapter, StorageMailboxAdapter } from "./adapters";

export { useMailbox, setMailboxRepository } from "./useMailbox";

export { seedMessages, seedContacts, createSeedState } from "./seed";
