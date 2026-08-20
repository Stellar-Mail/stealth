// ---------------------------------------------------------------------------
// BETA-012 — isolated demo route.
//
// Demo mode is reachable ONLY here: an explicit development-only flag
// (`STEALTH_DEMO_BYPASS_FETCH`) AND the `/demo` route. In production builds
// `import.meta.env.DEV` is statically false, so this page can never render
// the demo mailbox; anonymous visitors are also redirected by RouteGate
// before this component runs.
// ---------------------------------------------------------------------------

import { createFileRoute, Navigate } from "@tanstack/react-router";

import { BootstrapLoadingSkeleton } from "@/features/identity";
import { MailApp } from "@/features/mail";

export const Route = createFileRoute("/demo")({
  component: DemoRoute,
});

function DemoRoute() {
  if (typeof window === "undefined") {
    return <BootstrapLoadingSkeleton />;
  }
  const demoEnabled =
    import.meta.env.DEV && window.localStorage?.getItem("STEALTH_DEMO_BYPASS_FETCH") === "true";
  if (!demoEnabled) {
    return <Navigate to="/auth/sign-in" replace />;
  }
  return <MailApp isDemoMode />;
}
