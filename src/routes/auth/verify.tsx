import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VerifyEmailPage } from "@/features/identity/auth-pages";

export const Route = createFileRoute("/auth/verify")({
  validateSearch: z.object({ email: z.string().optional(), next: z.string().optional() }),
  component: VerifyEmailRoute,
});

function VerifyEmailRoute() {
  const { email } = Route.useSearch();
  return <VerifyEmailPage email={email} />;
}
