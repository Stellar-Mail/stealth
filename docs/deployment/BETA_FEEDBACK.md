# BETA-096 — Privacy-safe beta feedback

This runbook covers the beta-user and operator workflow delivered for issue #2003. The workflow is implemented in the application, API, durable repository adapter, and operations console; it is not a documentation-only process.

## Privacy contract

Nothing is attached automatically. A tester must explicitly enter reproduction steps, opt in to diagnostics, select a screenshot, review it, and separately consent to sharing it.

The diagnostic object is a strict allowlist:

| Field           | Value retained                                         | Value excluded                                      |
| --------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `appVersion`    | Public release/build identifier, at most 80 characters | Deployment secrets and environment dumps            |
| `browser`       | Browser family/major and operating-system family       | Raw user-agent and fingerprinting details           |
| `route`         | Path only, with long/dynamic identifiers replaced      | Query, fragment, message/account identifiers        |
| `featureFlags`  | Known public flag names only                           | Flag values, unknown names, token/secret-like names |
| `supportId`     | Latest validated `sup_…` correlation reference         | Request payloads and logs                           |
| `serviceStatus` | `healthy`, `degraded`, `unavailable`, or `unknown`     | Dependency responses and configuration              |

The submission schema rejects unknown keys. It therefore cannot accept automatically collected message bodies, tokens, private keys, address books, or attachments. Explicit tester prose is redacted again on the server for high-confidence password, bearer/JWT, Stellar seed/address, email, private-key block, and long-hex patterns.

A screenshot is optional and requires a second consent. Before upload, the browser decodes and re-encodes its pixels as WebP, which discards the file name and embedded metadata. The server independently validates the data URL, media type, magic bytes, and one-MiB decoded limit. Operators do not receive screenshot bytes in list or export responses; viewing and irreversible removal use dedicated audited endpoints.

## Configuration and least privilege

1. Set `VITE_APP_VERSION` to the public release identifier.
2. Set `VITE_FEATURE_FLAGS` only to comma-separated public names supported by `src/features/feedback/diagnostics.ts`. Unknown names are dropped.
3. Set `STEALTH_ADMIN_ADDRESSES` to the smallest comma-separated allowlist of current operator Stellar addresses. Production fails closed when the allowlist is empty.
4. Keep the existing KV binding configured. Feedback records use the `feedback:` prefix and schema version 1. There is no new provider or provider-console step.
5. Do not put credentials in these values, command output, issues, PRs, or evidence.

Repository-side configuration verification:

```sh
bun install --frozen-lockfile
bun run config:check
bun run ci:verify-versions
```

## Beta-user journey

1. Sign in to the beta stack and remain on the affected screen.
2. Open **Help**, then **Report a problem**.
3. Select category and severity and write reproduction steps without pasting message text or secrets.
4. Leave diagnostics off or enable them and inspect the exact JSON preview.
5. Optionally select a PNG, JPEG, or WebP screenshot. Inspect the re-encoded preview, remove visible sensitive content if necessary, and grant screenshot consent.
6. Submit and retain the `fb_…` reference shown by the application.

Expected failures are actionable: an unauthenticated tester receives `401`, invalid or non-consented data receives `422`, invalid screenshot bytes receive `400`, oversized payloads receive `413`, and spam limits receive `429` plus `Retry-After`.

## Operator journey

1. Sign in recently with an allowlisted operator account.
2. Open `/admin/feedback`.
3. Filter new, triaged, or closed reports. List responses show screenshot type/size but never bytes.
4. Enter the reason for the operation and an optional redacted triage note.
5. Mark the report triaged, close it after resolution, or reopen it as the recovery path.
6. View a consented screenshot only when needed. Remove it after consent withdrawal or when it is no longer necessary; the UI requires explicit confirmation.
7. Export JSON or CSV when needed. Both formats omit screenshot bytes and raw account addresses; CSV cells neutralize spreadsheet formulas.

All create, workflow, view, removal, and export actions emit structured audit events with pseudonymous actor references and safe report references. Mutation audits additionally retain a server-redacted operator reason and allowlisted before/after state (`category`, `severity`, `status`, screenshot-presence boolean, and version); they never include reproduction steps, diagnostics, or screenshot bytes. Concurrent operator writes use `expectedVersion`; a stale write receives `409` and must recover by refreshing and retrying against the new version.

## Repeatable security and acceptance evidence

Run the production-like handler/repository journey and the real HTTP/browser journey:

```sh
bun run test:beta:feedback
bun run test:beta:feedback:web
```

The first command covers redaction, strict unknown-field rejection, consent, request/screenshot limits, screenshot spoofing/removal, session and role authorization, account spam limits, safe JSON/CSV export, audit-log minimization, stale-write denial, close, and reopen rollback. It writes a redacted machine-readable result to `tests/e2e/live-beta/feedback-run-report.json`.

The second command starts the configured Playwright web server, exercises the tester journey through the affected mail screen and real feedback endpoint, checks for feature/page errors, and writes a dialog-only screenshot to `docs/evidence/BETA-096/feedback-diagnostics-preview.png`. The screenshot is taken before reproduction steps are entered and does not include the obscured mailbox behind the modal.

Run the relevant release checks and record their exact outputs in the PR:

```sh
bun run format:check
bun run lint
bun x tsc --noEmit
bun run test
bun run test:security
bun run test:e2e
bun run build
bun run config:check
bun run ci:verify-versions
bun run ci:verify-drift
bun run generate:openapi
bun run ci:scan-artifacts
```

Before publishing evidence, scan tracked changes and generated artifacts and confirm that no plaintext message, password, token, seed, private key, or production credential is present.

## Dependency and release gate

Do not sign off BETA-096 unless BETA-075 (#1982), BETA-091 (#1998), and BETA-093 (#2000) are closed and required CI checks pass. A repeatable GitHub check is:

```sh
gh issue view 1982 --repo Stellar-Mail/stealth --json state,stateReason,url
gh issue view 1998 --repo Stellar-Mail/stealth --json state,stateReason,url
gh issue view 2000 --repo Stellar-Mail/stealth --json state,stateReason,url
```

Any failed gate must be reported with the command, redacted result, reproduction, and owning team. A failed dependency or critical privacy/security test blocks release.

## Rollback and recovery

This change adds an additive `feedback:` KV record family and no destructive migration.

- For a stale operator mutation (`409`), refresh the console and retry with the current version.
- To undo an erroneous close, reopen the report to `triaged`; this is the tested workflow rollback.
- Screenshot removal is intentionally irreversible. Confirm the report reference and operator reason before deletion.
- For a defective release, stop feedback traffic by rolling the application back to the previous pinned deployment using `docs/deployment/RELEASE_GATES.md`. The earlier release ignores additive `feedback:` records; it does not delete or rewrite them.
- After application rollback, verify `/api/v1/health`, confirm that the prior mail journey works, preserve the redacted evidence, and assign any release blocker to `platform/client`, `feedback-api`, `feedback-operations`, or `security/platform` as appropriate.
- Re-deploy the fixed version and re-run both BETA-096 evidence commands before restoring sign-off.
