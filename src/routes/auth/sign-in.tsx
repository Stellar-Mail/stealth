import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SignInPage } from "@/features/identity/auth-pages";

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: z.object({ next: z.string().optional() }),
  component: SignInRoute,
});

function SignInRoute() {
  const { next } = Route.useSearch();
  return <SignInPage destination={next} />;
}
