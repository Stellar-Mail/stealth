import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { MailQuestion } from "lucide-react";

import { ActionButton, EmptyState, Surface } from "@/features/design-system";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="ambient-bg flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <Surface variant="modal" padding="lg" className="w-full max-w-xl">
        <EmptyState
          eyebrow="Delivery failed"
          icon={<MailQuestion className="size-6" />}
          title="This route has no recipient"
          description="The page may have moved, expired, or never existed. Return to your private inbox to continue."
          action={
            <ActionButton asChild size="lg">
              <Link to="/">Return to inbox</Link>
            </ActionButton>
          }
        />
      </Surface>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Stealth" },
      {
        name: "description",
        content: "Cryptographic mail identities, postage, and delivery proofs on Stellar.",
      },
      { name: "author", content: "Stealth" },
      { property: "og:title", content: "Stealth" },
      {
        property: "og:description",
        content: "Cryptographic mail identities, postage, and delivery proofs on Stellar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@stealthmail" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <div aria-live="polite" aria-atomic="true" className="sr-only" role="status" />
        <div aria-live="assertive" aria-atomic="true" className="sr-only" role="alert" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
