// BETA-051 (Issue #1958) — isolated demo mailbox adapter.
//
// The app shell's production path must have no route to the demo fixtures.
// This adapter owns the mock data import and is only wired in by explicit
// development stories/tests (see `src/routes/index.tsx` demo branch and the
// mail feature tests). Production builds never import this module.

import { emails as mockEmails } from "@/components/mail/data";
import type { Email } from "@/components/mail/data";

/** The demo mailbox fixture list. Never referenced from the production shell. */
export function getDemoEmails(): Email[] {
  return mockEmails;
}
