/**
 * Data layer exports for offline-first mailbox state.
 */

// Types
export type {
  Message,
  Thread,
  Contact,
  SenderPolicyRecord,
  ProofRecord,
  SyncCursor,
  LoadingState,
  MailboxState,
  IdempotentMutation,
} from "./types";

// Repositories
export type {
  MessageRepository,
  ThreadRepository,
  ContactRepository,
  SenderPolicyRepository,
  ProofRepository,
  SyncCursorRepository,
  DataAdapter,
} from "./repositories";

// Adapters
export { DeterministicAdapter, OfflineFirstAdapter } from "./adapters";

// Factory
export {
  createAdapter,
  getAdapterInstance,
  switchAdapter,
  resetAdapter,
  getCurrentAdapterType,
  getCurrentAdapterName,
} from "./factory";

// Migrations
export {
  runMigrations,
  registerMigration,
  getSchemaVersion,
  resetSchemaVersion,
} from "./migrations";
