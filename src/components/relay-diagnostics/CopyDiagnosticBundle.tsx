"use client";

import { useEffect, useRef, useState } from "react";

import type { RelayDiagnosticsResponse } from "@/server/api/relay-diagnostics-service";

import { Button } from "@/components/ui/button";

function toClipboardPayload(diagnostics: RelayDiagnosticsResponse) {
  return {
    relayId: diagnostics.relayId,
    status: diagnostics.status,
    signals: diagnostics.signals,
    queueDepth: diagnostics.queueDepth,
    retryCount: diagnostics.retryCount,
    deadLetterCount: diagnostics.deadLetterCount,
    lastSuccessfulDelivery: diagnostics.lastSuccessAt ?? null,
    lastFailedDelivery: diagnostics.lastFailureAt ?? null,
  };
}

export function CopyDiagnosticBundle({ diagnostics }: { diagnostics: RelayDiagnosticsResponse }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(toClipboardPayload(diagnostics), null, 2));
      setCopied(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard access can fail in restricted browser contexts.
    }
  }

  return (
    <Button
      type="button"
      onClick={handleCopy}
      className="fixed bottom-4 right-4 z-20 border-[#1e2430] bg-[#13161b] text-slate-100 shadow-none hover:bg-[#171b22] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      variant="outline"
      aria-live="polite"
    >
      {copied ? "Copied ✓" : "Copy diagnostic report"}
    </Button>
  );
}
