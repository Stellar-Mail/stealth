"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import type { RelayDiagnosticsResponse } from "@/server/api/relay-diagnostics-service";

import { CopyDiagnosticBundle } from "@/components/relay-diagnostics/CopyDiagnosticBundle";
import { DiagnosticsTable } from "@/components/relay-diagnostics/DiagnosticsTable";
import { StatusCard } from "@/components/relay-diagnostics/StatusCard";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function getLastSuccessfulDelivery(diagnostics: RelayDiagnosticsResponse) {
  return diagnostics.lastSuccessAt ?? null;
}

function getLastFailedDelivery(diagnostics: RelayDiagnosticsResponse) {
  return diagnostics.lastFailureAt ?? null;
}

function formatLastDelivery(diagnostics: RelayDiagnosticsResponse) {
  const lastDelivery = getLastSuccessfulDelivery(diagnostics);

  if (!lastDelivery) {
    return "Never";
  }

  const date = new Date(lastDelivery);

  if (Number.isNaN(date.getTime())) {
    return lastDelivery;
  }

  return formatDistanceToNow(date, { addSuffix: true });
}

function LoadingCard() {
  return (
    <Card
      className="border-[#1e2430] bg-[#13161b] shadow-none"
      role="status"
      aria-label="Loading diagnostic metrics"
    >
      <div className="space-y-4 p-5">
        <Skeleton className="h-3 w-32 bg-slate-800/80" />
        <Skeleton className="h-8 w-40 bg-slate-800/80" />
        <Skeleton className="h-1 w-full bg-slate-800/80" />
      </div>
    </Card>
  );
}

function ErrorCard({ message }: { message?: string }) {
  return (
    <Card
      className="border-rose-500/40 bg-rose-950/20 shadow-none"
      role="alert"
      aria-live="assertive"
    >
      <div className="p-5 text-sm text-rose-100">
        {message ?? "Diagnostics unavailable — check your connection and try again"}
      </div>
    </Card>
  );
}

export function RelayDiagnosticsDashboard({ relayId }: { relayId: string }) {
  const query = useQuery({
    queryKey: ["relay-diagnostics", relayId],
    queryFn: async () => {
      const response = await fetch(`/relays/${encodeURIComponent(relayId)}/diagnostics`);

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || "Diagnostics unavailable");
      }

      return (await response.json()) as RelayDiagnosticsResponse;
    },
    refetchInterval: 30_000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <ErrorCard message={query.error?.message} />;
  }

  const diagnostics = query.data;
  const status = diagnostics.status;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatusCard label="Connected relay" value={relayId} status={status} />
        <StatusCard
          label="Queue depth"
          value={String(diagnostics.queueDepth)}
          unit="messages"
          status={status}
        />
        <StatusCard label="Retry count" value={String(diagnostics.retryCount)} status={status} />
        <StatusCard label="Last delivery" value={formatLastDelivery(diagnostics)} status={status} />
      </div>

      <DiagnosticsTable entries={[]} />

      <CopyDiagnosticBundle diagnostics={diagnostics} />
    </div>
  );
}
