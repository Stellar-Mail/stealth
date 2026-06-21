# Mail-to-Ticket Converter

Isolated V2 team tool workspace for converting inbound mail into reviewable ticket drafts.

## Ownership boundary

All work for this tool stays inside:

```text
tools/v2/team/mail-to-ticket-converter/
```

This folder does **not** wire into the main app shell, dashboard routing, authentication, wallet core, mail renderer, Stellar integration, database schema, or shared design system. A future integration issue must explicitly authorize any mounting or persistence.

## Security and performance hardening

This contribution adds a folder-local `MailToTicketSecurityGuard` that future core/UI work can reuse before creating a ticket draft:

- validates sender/recipient email shapes and opaque team ids;
- rejects header-injection-like input such as newline-delimited `Bcc:` fields;
- strips control characters and active markup (`script`, `iframe`, `object`, `embed`, `link`, `meta`);
- normalizes attachment names so paths cannot escape the tool boundary;
- truncates oversized subject/body/attachment-name fields with warnings;
- rejects too many recipients or attachments for immediate conversion;
- estimates processing cost so future integration can defer expensive conversions to a worker.

## Local API surface

```ts
import { MailToTicketSecurityGuard } from "./services/security-guard.service";

const guard = new MailToTicketSecurityGuard();
const result = guard.sanitize(mailInput);

if (result.ok && !guard.shouldDefer(mailInput)) {
  // Safe to pass result.value to future folder-local ticket draft logic.
}
```

No live network calls, secrets, production data, or app-level side effects are introduced.

## Validation

Run the isolated tests with:

```bash
npm test -- tools/v2/team/mail-to-ticket-converter/tests/security-guard.test.ts
```
