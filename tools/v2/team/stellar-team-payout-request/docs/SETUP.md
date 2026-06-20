# Stellar Team Payout Request - Setup and Development Guide

## Overview

This folder contains the Stellar Team Payout Request tool - an isolated, self-contained workspace for managing team payout requests via the Stellar blockchain.

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Stellar SDK (installed via `package.json` dependencies)
- Basic understanding of Stellar accounts and transactions

### Development Setup

```bash
# Clone and navigate to repo
cd stealth
cd tools/v2/team/stellar-team-payout-request

# Install dependencies (from repo root)
cd ../../../..
bun install

# Development workflow
bun dev
```

### Folder Structure

```
stellar-team-payout-request/
├── components/          # React components for UI
│   ├── PayoutForm.tsx
│   ├── PayoutStatus.tsx
│   └── index.ts
├── services/            # Business logic and APIs
│   ├── PayoutService.ts
│   ├── StellarService.ts
│   └── index.ts
├── hooks/               # Custom React hooks
│   ├── usePayoutRequest.ts
│   ├── useStellarAccount.ts
│   └── index.ts
├── tests/               # Test files
│   ├── unit/
│   ├── integration/
│   └── TEST_PLAN.md
├── fixtures/            # Test data and mocks
│   ├── mock-payouts.ts
│   ├── mock-stellar-responses.ts
│   └── test-recipients.ts
├── docs/                # Documentation
│   ├── SETUP.md         # This file
│   ├── API.md           # Component/function APIs
│   └── KNOWN_ISSUES.md  # Known limitations
├── README.md            # Overview
├── specs.md             # Issue specifications
└── .env.example         # Environment template
```

## Key Files and Responsibilities

### Components (`components/`)

**PayoutForm.tsx**

- Collects payout request details from user
- Validates input in real-time
- Handles form submission

**PayoutStatus.tsx**

- Displays payout request status
- Shows transaction details
- Indicates Stellar network status

### Services (`services/`)

**PayoutService.ts**

- Core payout logic
- Request validation
- State management for payouts

**StellarService.ts**

- Stellar blockchain interactions
- Account management
- Transaction submission
- Fee estimation

### Hooks (`hooks/`)

**usePayoutRequest**

- Manages payout request state
- Handles submission lifecycle
- Error and loading states

**useStellarAccount**

- Manages Stellar account connection
- Keypair handling
- Account balance tracking

### Fixtures (`fixtures/`)

Test data in `fixtures/` folder:

```typescript
// mock-payouts.ts
export const mockPayoutRequest = {
  id: "1",
  recipientEmail: "teammate@example.com",
  amount: "100.00",
  status: "pending",
  createdAt: new Date().toISOString(),
};

// mock-stellar-responses.ts
export const mockSuccessResponse = {
  id: "...",
  type: "payment",
  status: "success",
};
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
# Stellar configuration
VITE_STELLAR_NETWORK=testnet  # 'testnet' or 'public'
VITE_STELLAR_SERVER_URL=https://horizon-testnet.stellar.org
VITE_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Optional: Pre-configured keypair for testing (never production!)
VITE_TEST_KEYPAIR_SECRET=S... (testnet only)
```

## Common Development Tasks

### Adding a New Component

```bash
# Create component file
touch components/MyComponent.tsx

# Update components/index.ts
export { MyComponent } from './MyComponent';
```

### Adding Tests

```bash
# Create test file alongside implementation
touch tests/unit/MyComponent.test.tsx

# Run tests
bun test tests/unit/MyComponent.test.tsx
```

### Using Test Fixtures

```typescript
// In your test file
import { mockPayoutRequest } from '../fixtures/mock-payouts';

test('display payout details', () => {
  render(<PayoutStatus payout={mockPayoutRequest} />);
  expect(screen.getByText('$100.00')).toBeInTheDocument();
});
```

### Testing Stellar Interactions

```typescript
// In your test file
import { mockSuccessResponse } from "../fixtures/mock-stellar-responses";

test("submit payout to Stellar", async () => {
  // Tests use mocked Stellar responses
  const result = await submitPayout(mockPayoutRequest);
  expect(result.status).toBe("success");
});
```

## Stellar Integration Points

### Account Validation

The tool validates Stellar accounts before processing:

```typescript
// Check if account exists and is funded
const account = await stellarServer.accounts().accountId(accountId).call();
```

### Transaction Submission

Payouts are submitted as Stellar payment transactions:

```typescript
// Build transaction
const transaction = new TransactionBuilder(sourceAccount, {
  fee: BASE_FEE,
  networkPassphrase: NETWORK_PASSPHRASE,
})
  .addOperation(
    Operation.payment({
      destination: recipientAccount,
      asset: Asset.native(),
      amount: payoutAmount,
    }),
  )
  .build();

// Sign and submit
transaction.sign(keypair);
await horizonServer.submitTransaction(transaction);
```

### Fee Estimation

Network fees are estimated before submission:

```typescript
const baseFee = await horizonServer.feeStats().call();
const estimatedFee = (baseFee.base_fee * operationCount) / 1e7; // stroops to XLM
```

## Known Issues and Limitations

See [KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) for:

- Current limitations
- Workarounds
- Future improvements

## Testing Strategy

### Unit Tests

- Test individual functions in isolation
- Use mocked Stellar responses
- Fast execution

### Integration Tests

- Test component interactions
- Use real Stellar testnet (with fixture accounts)
- Slower, more comprehensive

See [tests/TEST_PLAN.md](./tests/TEST_PLAN.md) for detailed testing documentation.

### Running Tests

```bash
# All tests
bun test tools/v2/team/stellar-team-payout-request

# Watch mode
bun test --watch tools/v2/team/stellar-team-payout-request

# Coverage report
bun test --coverage tools/v2/team/stellar-team-payout-request
```

## API Documentation

See [docs/API.md](./docs/API.md) for:

- Component prop interfaces
- Service method signatures
- Hook return types

## Debugging

### Enable Debug Logging

```typescript
// In development
localStorage.setItem("DEBUG", "stealth:payout:*");
```

### Stellar Testnet Explorer

Monitor transactions on:
https://stellar.expert/explorer/testnet/

### Common Issues

**Transaction failed: insufficient balance**

- Ensure test account has XLM balance
- Check fee estimation

**Cannot connect to Stellar**

- Verify `VITE_STELLAR_SERVER_URL` is correct
- Check network connectivity

**Keypair validation fails**

- Ensure keypair uses correct network
- Check keypair format (must be base64-encoded secret)

## Review Checklist for New Code

When adding features or fixes, ensure:

- [ ] Code stays within tool folder boundary
- [ ] Uses local fixtures for tests (no real API calls)
- [ ] Includes test coverage
- [ ] Documentation is updated
- [ ] No changes to main app structure
- [ ] Follows tool's component patterns
- [ ] Error states are handled

## Integration With Main App

⚠️ **Not currently integrated** - This is a standalone V2 tool.

When integration is requested:

- Create separate integration issue
- Mounting code goes in app, not here
- This folder remains source of truth for tool logic
- No design system or routing changes in this issue

## Support and Questions

- Check existing comments in PR #668
- Review test failures in CI
- File issues specific to this tool
- See `../../README.md` for team tools guidelines

## Resources

- [Stellar Developer Docs](https://developers.stellar.org/)
- [Stellar SDKs & APIs](https://developers.stellar.org/docs/software-and-sdks/index)
- [Horizon API Reference](https://developers.stellar.org/api/introduction/index)
- [Soroban Documentation](https://soroban.stellar.org/) (if using contracts)

## Next Steps

1. Set up environment with `.env.local`
2. Review [TEST_PLAN.md](./tests/TEST_PLAN.md)
3. Check [API.md](./docs/API.md) for available functions
4. Run tests to verify setup: `bun test`
5. Start development or review existing code
