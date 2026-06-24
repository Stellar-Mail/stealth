# Reviewer Validation Guide - Role-Based Mail Access UI

This guide assists reviewers and OSS contributors in testing the Role-Based Mail Access Control Plane user interface.

---

## 1. Quick Verification Checklist

- [ ] Node.js guard tests pass (`node --test tools/v2/team/role-based-mail-access/tests/access-guards.test.mjs`).
- [ ] Vitest service tests pass (`npx vitest -c tools/v2/team/role-based-mail-access/vitest.config.ts run`).
- [ ] Prettier formatting is clean.
- [ ] Verification form catches malformed inputs (invalid email format, special chars in threadIds).
- [ ] Matrix checks dynamically grant or block requests.
- [ ] Threat Scan correctly identifies and rejects all 19 hostile payloads.
- [ ] Team size and attachment bounds limits trigger limit checks.

---

## 2. Running the Test Suites

### Unit Guard Tests (Node.js)

```bash
node --test tools/v2/team/role-based-mail-access/tests/access-guards.test.mjs
```

_Expected: 32 tests passed._

### UI Service State Tests (Vitest)

```bash
npx vitest -c tools/v2/team/role-based-mail-access/vitest.config.ts run
```

_Expected: 12 tests passed._

---

## 3. Interactive Walkthrough Validation (UI/UX)

If testing the demo harness visually in your local sandboxed app, check the following interactive paths:

### A. Simulating Access Requests (Presets)

1. Click the preset card `req-001` (Role: manager, Action: assign).
2. Observe:
   - Form fields auto-fill.
   - A pulsing "Evaluating..." state is displayed for 800ms.
   - An alert shows: `✓ Access Authorization Succeeded` (granted outcome).
   - An entry is logged in the "Clearance Check Audit Trail".
3. Click the preset card `req-003` (Role: viewer, Action: write).
4. Observe:
   - A pulsing "Evaluating..." state is displayed for 800ms.
   - An alert shows: `✕ Access Authorization Denied` (since viewers cannot write).
   - An audit entry is appended.

### B. Dynamically Modifying Access Policies

1. Select the preset `req-003` (viewer, write) and check that access is denied.
2. Go to the **Access Level Control Matrix** table.
3. Check the box under row **viewer**, column **write**.
4. Submit the verifier form again with `viewer` and `write`.
5. Observe:
   - The result shifts to **Granted**, proving permission policies bind dynamically.

### C. Threat Scan Verification

1. Click the red button **🛡 Run Threat Scan** in the console header.
2. Observe:
   - A loading scanner status pulse starts, evaluating the 19 hostile vectors.
   - An alert appears: `✓ Threat Scanning Validation Succeeded`.
   - The text confirms that all 19 hostile vectors (e.g. CRLF header injects, null-byte hacks, path traversals) were successfully blocked and logged.

### D. Size Limits Guard Check

1. Locate the **Boundary Limit Verifiers** panel.
2. Increase the "Simulated Team Size" field to `501`.
3. Observe:
   - The status badge shifts from "Safe" to "Limit Exceeded".
   - A validation message appears: `team size 501 exceeds safe limit of 500`.
4. Increase "Simulated Attachment Count" to `101`.
5. Observe:
   - The status badge shifts to "Limit Exceeded" with: `attachment count 101 exceeds safe limit of 100`.
