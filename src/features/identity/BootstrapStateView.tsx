import { AlertTriangle, LoaderCircle, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBootstrap } from "./useBootstrap";

export function BootstrapLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading application state"
      className="ambient-bg flex min-h-screen flex-col items-center justify-center p-4 sm:p-6"
    >
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl backdrop-blur">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LoaderCircle className="size-6 animate-spin" />
          </div>
          <div className="mx-auto h-6 w-3/4 animate-pulse rounded-md bg-muted" />
          <div className="mx-auto h-4 w-5/6 animate-pulse rounded-md bg-muted/60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted/40" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted/40" />
          <p className="text-center text-xs text-muted-foreground">
            Restoring session and initializing secure mailbox…
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function BootstrapStateView() {
  const { branch, data, error, retry, isRetrying } = useBootstrap();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [branch]);

  if (branch === "loading") {
    return <BootstrapLoadingSkeleton />;
  }

  if (branch === "suspended") {
    return (
      <main className="ambient-bg flex min-h-screen items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-md border-destructive/50 bg-card/95 shadow-xl backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle tabIndex={-1} ref={headingRef} className="outline-none text-destructive">
              Account suspended
            </CardTitle>
            <CardDescription>
              Your account has been suspended due to security policy violations or administrative
              review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              Account ID: {data?.user.userId ?? "unknown"}
            </div>
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:support@stealth.mail" target="_blank" rel="noreferrer">
                Contact support to appeal
              </a>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (branch === "outage" || branch === "maintenance") {
    const isOffline = error?.code === "offline";
    const Icon = isOffline ? WifiOff : AlertTriangle;

    return (
      <main className="ambient-bg flex min-h-screen items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-md border-amber-500/50 bg-card/95 shadow-xl backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <Icon className="size-6" />
            </div>
            <CardTitle tabIndex={-1} ref={headingRef} className="outline-none">
              {isOffline ? "You are offline" : "Service temporarily unavailable"}
            </CardTitle>
            <CardDescription>
              {error?.message ??
                "The mailbox service is undergoing maintenance or experiencing a transient failure."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={() => void retry()} disabled={isRetrying}>
              <RefreshCw className={`mr-2 size-4 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Retrying startup…" : "Retry connection"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Your local draft and mailbox data remain safely preserved.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return null;
}
