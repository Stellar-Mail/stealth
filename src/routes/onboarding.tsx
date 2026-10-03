import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clearBootstrapCache } from "@/features/identity/bootstrap";
import { useBootstrap } from "@/features/identity/useBootstrap";
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { data, retry, isRetrying } = useBootstrap();

  const onboarding = data?.onboarding;
  const completed = onboarding?.status === "completed";

  const handleComplete = async () => {
    // Invalidate the cached bootstrap so the route gate re-resolves the
    // account to "active" and routes the user home on the next pass.
    clearBootstrapCache();
    await retry();
  };

  if (data && !completed) {
    return (
      <OnboardingFlow
        account={{
          displayName: data.user.displayName,
          email: data.user.email,
          username: data.user.username,
        }}
        mailboxAddress={data.address ?? data.user.userId ?? ""}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <main className="ambient-bg flex min-h-screen items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <CheckCircle2 className="size-6" />
          </div>
          <CardTitle tabIndex={-1} className="outline-none">
            Finish setting up your account
          </CardTitle>
          <CardDescription>
            Your mailbox is still being prepared. Check again shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => void retry()}
            disabled={isRetrying}
          >
            {isRetrying && <RefreshCw className="mr-2 size-4 animate-spin" />}
            Check again
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth/sign-in" className="text-primary underline-offset-4 hover:underline">
              Sign in to your account <ArrowRight className="ml-1 inline size-3" />
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
