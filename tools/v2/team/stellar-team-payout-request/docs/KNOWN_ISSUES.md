# Known Issues and Limitations

## Current Status

The Stellar Team Payout Request tool is in development. This document tracks known limitations and workarounds.

## Issues

### 1. Testnet-Only Support

**Status:** By Design

**Description:** The tool currently works with Stellar testnet only. Production mainnet support requires additional security review and configuration.

**Workaround:**

- Use testnet for all development and testing
- Set `VITE_STELLAR_NETWORK=testnet` in environment
- Obtain testnet XLM from: https://developers.stellar.org/docs/tutorials/create-account

**Future:** Will support mainnet in separate security-review issue

---

### 2. Keypair Security

**Status:** Known Limitation

**Description:** Test keypairs are stored in environment variables. This is only acceptable for development/testing. Production deployment requires secure key management (e.g., AWS KMS, HashiCorp Vault).

**Current Approach:**

```env
# .env.local - DEVELOPMENT ONLY
VITE_TEST_KEYPAIR_SECRET=SB... (testnet key)
```

**Security Requirements for Production:**

- Never store secrets in `.env` files
- Use secure key manager
- Rotate keys regularly
- Audit key access

**Related Issue:** Security review needed before mainnet deployment

---

### 3. No Batch Payment Support

**Status:** Not Implemented

**Description:** Currently only handles single payouts. Batch processing would require additional logic.

**Workaround:**

- Submit payouts one at a time
- UI shows pending payouts list

**Future:** Batch payout support as separate issue

---

### 4. Limited Transaction History

**Status:** By Design for V2

**Description:** Tool doesn't persist transaction history to database. All data is ephemeral during session.

**Workaround:**

- Query Stellar ledger directly for historical transactions
- Export transaction ID for reference
- Manual tracking in external systems

**Future:** Database integration in separate V2 phase issue

---

### 5. No Scheduled Payments

**Status:** UI Support, Backend Not Implemented

**Description:** Form accepts `scheduledFor` field, but backend doesn't process scheduled payouts.

**Workaround:**

- Submit payouts immediately
- Implement external scheduler if needed

**Future:** Scheduled payment support as separate issue

---

### 6. Fee Estimation Assumes Single Operation

**Status:** Known Limitation

**Description:** `estimateFee()` assumes one operation per transaction. Batch payments would need updated calculation.

**Current:**

```typescript
fee = baseFeeRate * 1 operation = 100 stroops = 0.00001 XLM
```

**For Multiple Operations:**

```typescript
fee = baseFeeRate * N operations = 100 * N stroops
```

**Future:** Update when batch support added

---

### 7. No Destination Account Lookup

**Status:** By Design

**Description:** Tool requires full Stellar account ID. No email-to-account resolution.

**Workaround:**

- Require users to provide Stellar account ID (public key)
- Users can verify on Stellar.expert

**Future:** Email federation support in separate issue

---

### 8. Minimal Error Recovery

**Status:** Limited UI Feedback

**Description:** Error messages show error code but not user-friendly explanation.

**Current:** "Error: op_no_destination"

**Needed:** "Error: Destination account does not exist. Please verify the account ID."

**Workaround:**

- Check error logs for detailed Stellar responses
- Refer to Stellar documentation

**Future:** Enhanced error messages in separate UX issue

---

### 9. No Transaction Confirmation Polling

**Status:** UI Shows Last Known State

**Description:** After submission, tool doesn't poll for transaction confirmation. Must manually refresh.

**Workaround:**

- Click "Refresh" button to check status
- Or wait 5-10 seconds and reload page

**Future:** Add auto-polling with configurable interval

---

### 10. Test Account Requires Manual Funding

**Status:** Development Workflow

**Description:** Test keypairs in fixtures need manual funding from testnet faucet.

**Setup:**

1. Get public key from test keypair
2. Go to https://developers.stellar.org/docs/tutorials/create-account
3. Paste public key and fund
4. Test can now proceed

**Future:** Could automate in test setup

---

## Component-Specific Issues

### PayoutForm

- **Issue:** No debouncing on email validation

  - **Impact:** May trigger API call on every keystroke
  - **Workaround:** Add delay before validation

- **Issue:** Amount field allows copy-paste of invalid formats
  - **Impact:** Validation catches it but UX is poor
  - **Workaround:** Use number input type in HTML5

### PayoutStatus

- **Issue:** Doesn't refresh automatically
  - **Impact:** User must click refresh to see updates
  - **Workaround:** Implement polling in hook

### StellarService

- **Issue:** No timeout on network requests
  - **Impact:** May hang indefinitely on network failure
  - **Workaround:** Add request timeout configuration

---

## Workarounds and Solutions

### For Developers

**Test Payout Success:**

```typescript
// Use mock responses for unit tests
import { mockSuccessResponse } from "../fixtures";

// For integration tests, use real testnet with test account
```

**Check Transaction Status:**

- Use Stellar.expert: https://stellar.expert/explorer/testnet/
- Look up transaction by ID
- Verify payment was posted

**Debug Stellar Errors:**

```typescript
// Enable debug logging
localStorage.setItem("DEBUG", "stealth:stellar:*");

// Check browser console for detailed Stellar SDK logs
```

---

## Reporting Issues

When reporting issues:

1. Check this list first
2. Include exact error message
3. Provide reproduction steps
4. Attach transaction ID if available
5. Reference Stellar.expert link to transaction

---

## Future Improvements (Roadmap)

### High Priority

- [ ] User-friendly error messages
- [ ] Batch payment support
- [ ] Enhanced error recovery UI
- [ ] Transaction confirmation polling

### Medium Priority

- [ ] Email account resolution (federation)
- [ ] Scheduled payments
- [ ] Transaction history persistence
- [ ] Debounce validation

### Low Priority (Post-V2)

- [ ] Mainnet support
- [ ] Advanced fee options
- [ ] Multi-asset support
- [ ] Memo template library

---

## Getting Help

- **Code Issues:** Check PR comments on #668
- **Stellar Questions:** See https://developers.stellar.org/docs
- **Tool Design:** Review specs in specs.md
- **Tests:** See tests/TEST_PLAN.md

---

## Contributing

When fixing known issues:

1. Ensure fix stays within tool folder
2. Add tests for the fix
3. Update this document
4. Reference issue in commit message
5. Add before/after in PR description
