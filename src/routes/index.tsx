import { createFileRoute } from "@tanstack/react-router";

import { useBootstrap } from "@/features/identity";
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
  // BETA-053: this file is only the composition entrypoint. Mailbox
  // orchestration lives in `src/features/mail/shell`.
  //
  // In development builds the backend bindings are absent, so bootstrap never
  // resolves an active session. Rather than bouncing to sign-in, render the
  // mailbox with demo data so the UI is editable; auth routes stay reachable
  // by URL. In production this is statically false.
  const { branch } = useBootstrap();
  const useDemo = import.meta.env.DEV && branch !== "active";
  return <MailApp isDemoMode={useDemo} />;
}

