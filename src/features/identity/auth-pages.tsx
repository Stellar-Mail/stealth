import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { sharedTypedApi as api, errorLabel, ApiClientError } from "@/lib/api";
import { safeReturnTo } from "./returnTo";

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="ambient-bg flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl backdrop-blur">
        {children}
      </Card>
    </main>
  );
}

function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

export function SignUpPage({ destination }: { destination?: string }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("passwordConfirmation") ?? "");
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const registration = await api.auth.register({
        displayName: String(form.get("displayName") ?? ""),
        email: String(form.get("email") ?? ""),
        username: String(form.get("username") ?? ""),
        password,
        passwordConfirmation: confirmation,
        termsVersion: "2026-01",
        privacyPolicyVersion: "2026-01",
      });
      await navigate({
        to: "/auth/verify",
        search: {
          email: registration.maskedEmail ?? "your email",
          next: safeReturnTo(destination),
        },
      });
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? errorLabel(cause)
          : "We could not create your account. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail />
        </div>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          No wallet connection is needed. Use an email and password to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <FormError message={error} />
          <label className="grid gap-1.5 text-sm font-medium">
            Name
            <Input name="displayName" autoComplete="name" required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Email address
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Username
            <Input name="username" autoComplete="username" pattern="[a-z0-9_-]{3,30}" required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Password
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Confirm password
            <Input
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          <Button className="w-full" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />}
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            className="text-primary underline-offset-4 hover:underline"
            to="/auth/sign-in"
            search={{ next: safeReturnTo(destination) }}
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </AuthLayout>
  );
}

export function SignInPage({ destination }: { destination?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api.auth.login({
        identifier: String(form.get("identifier") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      window.location.assign(safeReturnTo(destination));
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.status === 403
            ? "Your account needs email verification before you can sign in."
            : cause.status === 401
              ? "Invalid email, username, or password."
              : errorLabel(cause)
          : "We could not sign you in. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <AuthLayout>
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck />
        </div>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your credentials to access your private mailbox.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <FormError message={error} />
          <label className="grid gap-1.5 text-sm font-medium">
            Email or username
            <Input name="identifier" autoComplete="username" required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Password
            <Input name="password" type="password" autoComplete="current-password" required />
          </label>
          <Button className="w-full" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />}
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          New to Stealth?{" "}
          <Link
            className="text-primary underline-offset-4 hover:underline"
            to="/auth/sign-up"
            search={{ next: safeReturnTo(destination) }}
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </AuthLayout>
  );
}

export function VerifyEmailPage({ email }: { email?: string }) {
  return (
    <AuthLayout>
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 />
        </div>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent a verification link to {email || "your email address"}. Open it in this browser to
          finish setting up your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          The link may take a few minutes to arrive. If it expires, return to this page from a new
          registration email.
        </p>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/auth/sign-in">Back to sign in</Link>
        </Button>
      </CardContent>
    </AuthLayout>
  );
}
