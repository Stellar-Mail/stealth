# Mailbox Data Layer

A typed, offline-first data layer for managing mailbox state with deterministic testing and production adapters.

## Overview

The mailbox feature replaces hard-coded component data with a structured repository pattern that:

- Decouples components from seed data
- Provides deterministic and testnet adapters
- Supports idempotent mutations
- Handles offline-first state with localStorage
- Enables reliable synchronization and recovery

## Architecture

### Types (`types.ts`)

Core domain types:

- **Message**: Individual email with metadata (id, from, subject, timestamp, etc.)
- **Thread**: Grouped messages with conversation metadata
- **Contact**: Verified/trusted contact information
- **Policy**: Mailbox inbox rules
- **Proof**: Delivery and read proofs
- **SyncCursor**: Synchronization state tracking

### Repository Interface (`repository.ts`)

The `IMailboxRepository` interface defines all data operations:

```typescript
interface IMailboxRepository {
  // Messages
  getMessages(): Promise<Message[]>;
  getMessage(id: string): Promise<Message | null>;
  createMessage(message: Message): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message>;
  deleteMessage(id: string): Promise<void>;

  // Threads, Contacts, Policy, Proofs...
  // Similar CRUD operations for other entities
}
```

### Adapters

#### Memory Adapter (`adapters/memory-adapter.ts`)

In-memory storage using JavaScript Maps. Ideal for:

- Deterministic testing
- Development without persistence

```typescript
import { MemoryMailboxAdapter } from "@/features/mailbox/adapters";

const adapter = new MemoryMailboxAdapter();
const messages = await adapter.getMessages();
```

#### Storage Adapter (`adapters/storage-adapter.ts`)

localStorage-backed persistence with memory fallback. Ideal for:

- Production offline-first usage
- Client-side data persistence
- Automatic hydration on page load

```typescript
import { StorageMailboxAdapter } from "@/features/mailbox/adapters";

const adapter = new StorageMailboxAdapter();
const messages = await adapter.getMessages();
// Automatically persisted to localStorage
```

### Hook (`useMailbox.ts`)

React hook for managing mailbox state:

```typescript
const mailbox = useMailbox();

// Access state
mailbox.state.messages;
mailbox.state.policy;
mailbox.loadingState; // "idle" | "loading" | "stale" | "error"
mailbox.error;

// Message operations
await mailbox.messages.create(message);
await mailbox.messages.update(id, updates);
await mailbox.messages.delete(id);

// Contact operations
await mailbox.contacts.update(address, updates);

// Policy operations
await mailbox.policy.update(policy);
```

### Seed Data (`seed.ts`)

Default data for development and testing:

```typescript
import { createSeedState, seedMessages, seedContacts } from "@/features/mailbox";

const initialState = createSeedState();
```

## Usage

### In Components

```typescript
import { useMailbox } from "@/features/mailbox";
import { StorageMailboxAdapter } from "@/features/mailbox/adapters";

function MyComponent() {
  const mailbox = useMailbox();

  if (mailbox.loadingState === "loading") return <div>Loading...</div>;
  if (mailbox.error) return <div>Error: {mailbox.error.message}</div>;

  return (
    <div>
      {mailbox.state.messages.map((msg) => (
        <div key={msg.id} onClick={() => mailbox.messages.update(msg.id, { unread: false })}>
          {msg.subject}
        </div>
      ))}
    </div>
  );
}
```

### In Tests

```typescript
import { MemoryMailboxAdapter } from "@/features/mailbox/adapters";
import { setMailboxRepository } from "@/features/mailbox";

describe("Mailbox", () => {
  it("should create messages", async () => {
    const adapter = new MemoryMailboxAdapter();
    setMailboxRepository(adapter);

    const message = await adapter.createMessage({
      id: "test-1",
      from: "sender@example.com",
      // ... other fields
    });

    expect(message.id).toBe("test-1");
  });
});
```

## State Management

### Loading States

- **idle**: Ready to use, no pending operations
- **loading**: Initial state loading in progress
- **stale**: Data exists but sync is in progress
- **error**: Failed to load or persist data

### Idempotent Mutations

All mutations are idempotent:

```typescript
// Can be called multiple times safely
await mailbox.messages.update(id, { starred: true });
await mailbox.messages.update(id, { starred: true }); // No duplicates
```

### Offline Behavior

Storage adapter continues working offline:

```typescript
const mailbox = useMailbox(); // Uses StorageMailboxAdapter by default

// Works offline - reads from localStorage
const messages = await mailbox.state.messages;

// Works offline - queued for sync
await mailbox.messages.update(id, { unread: false });
```

## Migration Strategy

### Version Control

MailboxState includes a version number for migrations:

```typescript
export type MailboxState = {
  version: number;
  messages: Message[];
  // ... other fields
};
```

### Adding a Migration

1. Increment `version` in `createSeedState()`
2. Add migration logic in adapter initialization
3. Test with both old and new schema

```typescript
async ensureInitialized(): Promise<void> {
  const state = loadFromStorage();
  if (state?.version === 1) {
    state = migrateFromV1toV2(state);
  }
  await this.memory.setState(state);
}
```

## Testing

### Unit Tests

```bash
npm run test -- src/features/mailbox
```

### Running Against Test Adapters

Use `MemoryMailboxAdapter` for deterministic tests:

```typescript
const adapter = new MemoryMailboxAdapter();
const testState = createSeedState();
await adapter.setState(testState);

// Run UI tests against adapter
```

## Success Signals

- ✅ Components depend on interfaces, not seed data
- ✅ Loading, stale, offline, and error states modeled
- ✅ Mutations are idempotent
- ✅ Migration strategy exists for schema changes
- ✅ Same test suite passes against memory and storage adapters
