import { createFileRoute } from "@tanstack/react-router";

import { MailApp } from "@/features/mail";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stealth" },
      {
        name: "description",
        content: "Stealth is a cryptographic mail client built on Stellar.",
      },
      { property: "og:title", content: "Stealth" },
      {
        property: "og:description",
        content: "Cryptographic mail identities, postage, and delivery proofs on Stellar.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  // BETA-012: the root route is a protected route. The root route guard
  // (RouteGate) only ever lets authenticated, active visitors reach this page,
  // so the app shell never renders in demo mode here. Demo mode lives on the
  // isolated `/demo` route behind an explicit development-only flag.
  //
  // BETA-053: this file is only the composition entrypoint. Mailbox
  // orchestration lives in `src/features/mail/shell`.
  return <MailApp isDemoMode={false} />;
}
