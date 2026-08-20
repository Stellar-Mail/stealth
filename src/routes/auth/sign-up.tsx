import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SignUpPage } from "@/features/identity/auth-pages";

export const Route = createFileRoute("/auth/sign-up")({
  validateSearch: z.object({ next: z.string().optional() }),
  component: SignUpRoute,
});

function SignUpRoute() {
  const { next } = Route.useSearch();
  return <SignUpPage destination={next} />;
}
