# API Documentation - Stellar Team Payout Request

## Components

### PayoutForm

Form component for creating new payout requests.

```typescript
interface PayoutFormProps {
  onSubmit: (request: PayoutFormData) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  onCancel?: () => void;
}

interface PayoutFormData {
  recipientEmail: string;
  amount: string;
  memo?: string;
  scheduledFor?: Date;
}
```

**Usage:**

```tsx
<PayoutForm
  onSubmit={async (data) => {
    await submitPayout(data);
  }}
  isLoading={false}
/>
```

**Features:**

- Real-time email validation
- Amount input with formatting
- Optional memo field
- Optional scheduled submission
- Accessible form labels and error messages

---

### PayoutStatus

Displays status of a submitted payout request.

```typescript
interface PayoutStatusProps {
  payout: PayoutRequest;
  onRetry?: () => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
}

interface PayoutRequest {
  id: string;
  recipientEmail: string;
  amount: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}
```

**Usage:**

```tsx
<PayoutStatus
  payout={myPayoutRequest}
  onRetry={async () => {
    await retryPayout(myPayoutRequest.id);
  }}
/>
```

**Displays:**

- Payout status with visual indicator
- Transaction ID (if confirmed)
- Created/updated timestamps
- Error message (if failed)
- Retry/cancel buttons

---

## Services

### PayoutService

Core business logic for payout operations.

```typescript
class PayoutService {
  // Create a new payout request
  async createPayoutRequest(data: PayoutFormData): Promise<PayoutRequest>;

  // Get all payouts for user
  async getPayouts(userId: string): Promise<PayoutRequest[]>;

  // Get single payout by ID
  async getPayoutById(id: string): Promise<PayoutRequest>;

  // Cancel pending payout
  async cancelPayout(id: string): Promise<void>;

  // Retry failed payout
  async retryPayout(id: string): Promise<PayoutRequest>;

  // Validate payout data before submission
  validatePayoutRequest(data: PayoutFormData): {
    valid: boolean;
    errors: Record<string, string>;
  };
}
```

**Example Usage:**

```typescript
const service = new PayoutService();

// Validate before submit
const validation = service.validatePayoutRequest({
  recipientEmail: "user@example.com",
  amount: "100.00",
});

if (validation.valid) {
  const payout = await service.createPayoutRequest({
    recipientEmail: "user@example.com",
    amount: "100.00",
  });
  console.log("Payout created:", payout.id);
}
```

---

### StellarService

Stellar blockchain integration.

```typescript
class StellarService {
  // Initialize with keypair
  initialize(keypair: Keypair): void;

  // Get account details
  async getAccount(accountId: string): StellarAccount;

  // Submit payment transaction
  async submitPayment(
    destinationId: string,
    amount: string,
    memo?: string,
  ): Promise<TransactionResult>;

  // Check transaction status
  async getTransactionStatus(txId: string): TransactionStatus;

  // Estimate transaction fee
  async estimateFee(operationCount: number): Promise<string>;

  // Validate Stellar account ID
  isValidAccountId(accountId: string): boolean;
}

interface StellarAccount {
  id: string;
  balance: string;
  sequenceNumber: string;
  subentryCount: number;
}

interface TransactionResult {
  id: string;
  status: "success" | "failure";
  ledger: number;
  timestamp: string;
}

interface TransactionStatus {
  status: "pending" | "confirmed" | "failed";
  confirmations: number;
  error?: string;
}
```

**Example Usage:**

```typescript
import { Keypair } from "stellar-sdk";

const service = new StellarService();
const keypair = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY);

service.initialize(keypair);

// Check balance
const account = await service.getAccount(keypair.publicKey());
console.log("Balance:", account.balance, "XLM");

// Submit payment
const result = await service.submitPayment(destinationAccountId, "50.00", "Team payout for Q1");
```

---

## Hooks

### usePayoutRequest

Manages payout request lifecycle.

```typescript
interface UsePayoutRequestResult {
  payout: PayoutRequest | null;
  isLoading: boolean;
  error: string | null;
  isSubmitting: boolean;

  submit: (data: PayoutFormData) => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

function usePayoutRequest(payoutId?: string): UsePayoutRequestResult;
```

**Usage:**

```tsx
function MyComponent() {
  const { payout, isLoading, error, submit, retry } = usePayoutRequest();

  return (
    <>
      {isLoading && <div>Loading...</div>}
      {error && (
        <div>
          Error: {error}
          <button onClick={retry}>Retry</button>
        </div>
      )}
      {payout && <PayoutStatus payout={payout} />}
      <PayoutForm onSubmit={submit} />
    </>
  );
}
```

---

### useStellarAccount

Manages Stellar account connection.

```typescript
interface UseStellarAccountResult {
  account: StellarAccount | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  connect: (keypair: Keypair) => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
}

function useStellarAccount(): UseStellarAccountResult;
```

**Usage:**

```tsx
function AccountConnector() {
  const { account, isConnected, connect, refresh } = useStellarAccount();

  return (
    <>
      {isConnected ? (
        <div>
          Connected: {account?.id}
          Balance: {account?.balance} XLM
          <button onClick={refresh}>Refresh</button>
        </div>
      ) : (
        <button onClick={() => connect(myKeypair)}>Connect Account</button>
      )}
    </>
  );
}
```

---

## Utilities

### Validation

```typescript
// Validate email format
export function isValidEmail(email: string): boolean;

// Validate Stellar account ID (public key)
export function isValidStellarAccount(accountId: string): boolean;

// Validate XLM amount
export function isValidAmount(amount: string): boolean;
// Must be parseable as number
// Must be > 0
// Max 2 decimal places

// Validate memo string
export function isValidMemo(memo: string): boolean;
// Max 28 bytes for text memo
```

**Usage:**

```typescript
if (!isValidEmail(email)) {
  throw new Error("Invalid email format");
}

if (!isValidAmount(amount)) {
  throw new Error("Invalid amount (max 2 decimals, must be > 0)");
}
```

---

## Types

```typescript
// Main payout request type
interface PayoutRequest {
  id: string;
  userId: string;
  recipientEmail: string;
  recipientStellarId?: string;
  amount: string; // In XLM, string for precision
  memo?: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
  transactionId?: string;
  error?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  scheduledFor?: string; // ISO 8601, optional
  submittedAt?: string;
  confirmedAt?: string;
}

// Form submission data
interface PayoutFormData {
  recipientEmail: string;
  amount: string;
  memo?: string;
  scheduledFor?: Date;
}

// Stellar transaction details
interface StellarTransaction {
  id: string;
  sourceAccount: string;
  destinationAccount: string;
  amount: string;
  asset: "native" | string; // 'native' for XLM
  memo?: string;
  fee: string; // In stroops (1 XLM = 10^7 stroops)
  ledger: number;
  createdAt: string;
}
```

---

## Error Handling

Common errors and how to handle them:

```typescript
// Validation errors
try {
  await service.createPayoutRequest(invalidData);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error("Validation failed:", error.errors);
    // error.errors = { recipientEmail: 'Invalid format' }
  }
}

// Stellar network errors
try {
  await stellarService.submitPayment(dest, amount);
} catch (error) {
  if (error.type === "STELLAR_ERROR") {
    // Handle Stellar-specific errors
    if (error.code === "insufficient_balance") {
      // Account doesn't have enough XLM
    } else if (error.code === "destination_not_found") {
      // Destination account doesn't exist
    }
  }
}

// Network/connection errors
try {
  await service.getPayouts(userId);
} catch (error) {
  if (error instanceof NetworkError) {
    // Retry with exponential backoff
  }
}
```

---

## Testing With Fixtures

Test data is provided in `fixtures/`:

```typescript
// In your test
import { mockPayoutRequest, mockStellarAccount } from "../fixtures";

test("display payout status", () => {
  render(<PayoutStatus payout={mockPayoutRequest} />);
  expect(screen.getByText(mockPayoutRequest.amount)).toBeInTheDocument();
});
```

Fixtures are updated as requirements change. Never hardcode test data.

---

## Configuration

```typescript
// Environment variables used by services
const config = {
  stellarNetworkPassphrase: process.env.VITE_STELLAR_NETWORK_PASSPHRASE,
  stellarServerUrl: process.env.VITE_STELLAR_SERVER_URL,
  baseFeeRate: 100, // stroops per operation
  maxRetries: 3,
  retryDelayMs: 1000,
};
```

---

## See Also

- [Setup Guide](./SETUP.md)
- [Test Plan](../tests/TEST_PLAN.md)
- [Known Issues](./KNOWN_ISSUES.md)
