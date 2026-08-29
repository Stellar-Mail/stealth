import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ImagePlus, Loader2, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  collectFeedbackDiagnostics,
  prepareFeedbackScreenshot,
  type PreparedFeedbackScreenshot,
} from "./diagnostics";
import type { FeedbackCategory, FeedbackDiagnostics, FeedbackSeverity } from "@/server/api/domain";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actor?: string | null;
  onSubmitted?: (reportId: string) => void;
}

const categories: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "performance", label: "Performance" },
  { value: "usability", label: "Usability" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

const severities: Array<{ value: FeedbackSeverity; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function FeedbackDialog({ open, onOpenChange, actor, onSubmitted }: FeedbackDialogProps) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [severity, setSeverity] = useState<FeedbackSeverity>("medium");
  const [steps, setSteps] = useState("");
  const [diagnosticsConsent, setDiagnosticsConsent] = useState(false);
  const [diagnostics, setDiagnostics] = useState<FeedbackDiagnostics | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [screenshot, setScreenshot] = useState<PreparedFeedbackScreenshot | null>(null);
  const [screenshotConsent, setScreenshotConsent] = useState(false);
  const [processingScreenshot, setProcessingScreenshot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingDiagnostics(true);
    void collectFeedbackDiagnostics()
      .then((result) => {
        if (!cancelled) setDiagnostics(result);
      })
      .finally(() => {
        if (!cancelled) setLoadingDiagnostics(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const preview = {
    diagnostics: diagnosticsConsent ? diagnostics : null,
    screenshot:
      screenshotConsent && screenshot
        ? { mediaType: screenshot.mediaType, sizeBytes: screenshot.sizeBytes }
        : null,
  };

  const reset = () => {
    setCategory("bug");
    setSeverity("medium");
    setSteps("");
    setDiagnosticsConsent(false);
    setScreenshot(null);
    setScreenshotConsent(false);
    setError(null);
  };

  const handleScreenshot = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setScreenshotConsent(false);
    setProcessingScreenshot(true);
    try {
      setScreenshot(await prepareFeedbackScreenshot(file));
    } catch (caught) {
      setScreenshot(null);
      setError(caught instanceof Error ? caught.message : "Could not process screenshot");
    } finally {
      setProcessingScreenshot(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (diagnosticsConsent && !diagnostics) {
      setError("Diagnostics are still loading. Try again in a moment.");
      return;
    }
    if (screenshot && !screenshotConsent) {
      setError("Confirm screenshot consent or remove the screenshot before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const headers = new Headers({ "content-type": "application/json" });
      if (import.meta.env.DEV && actor) headers.set("x-stealth-address", actor);
      const response = await fetch("/api/v1/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({
          category,
          severity,
          steps,
          diagnosticsConsent,
          diagnostics: diagnosticsConsent ? diagnostics : null,
          screenshotConsent: screenshot !== null && screenshotConsent,
          screenshot:
            screenshot !== null && screenshotConsent ? { dataUrl: screenshot.dataUrl } : null,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message || "Feedback could not be submitted");
      }
      const reportId = String(body.data.reportId);
      onSubmitted?.(reportId);
      reset();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Feedback could not be submitted");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Report a beta problem</DialogTitle>
            <DialogDescription>
              Describe what happened. Message content, credentials, contacts, and attachments are
              never collected automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                className="h-9 w-full rounded-md border border-input bg-background px-3"
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Severity</span>
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value as FeedbackSeverity)}
                className="h-9 w-full rounded-md border border-input bg-background px-3"
              >
                {severities.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Steps to reproduce</span>
            <Textarea
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
              minLength={10}
              maxLength={4000}
              rows={6}
              required
              placeholder="1. Open… 2. Select… 3. Observe… Do not paste message text or secrets."
            />
            <span className="block text-right text-xs text-muted-foreground">
              {steps.length}/4000
            </span>
          </label>

          <div className="rounded-lg border p-4 space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={diagnosticsConsent}
                onCheckedChange={(checked) => setDiagnosticsConsent(checked === true)}
                aria-label="Include privacy-safe diagnostics"
              />
              <span>
                <span className="font-medium">Include privacy-safe diagnostics</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Only the previewed app version, browser summary, route, enabled flags, support ID,
                  and service status will be sent.
                </span>
              </span>
            </label>
            <pre
              aria-label="Diagnostic data preview"
              className="max-h-52 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap"
            >
              {loadingDiagnostics ? "Loading safe diagnostics…" : JSON.stringify(preview, null, 2)}
            </pre>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                {processingScreenshot ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                Add optional screenshot
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={processingScreenshot}
                  onChange={(event) => void handleScreenshot(event.target.files?.[0])}
                />
              </label>
              {screenshot ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setScreenshot(null);
                    setScreenshotConsent(false);
                  }}
                >
                  <Trash2 /> Remove screenshot
                </Button>
              ) : null}
            </div>
            {screenshot ? (
              <>
                <img
                  src={screenshot.dataUrl}
                  alt="Screenshot that will be submitted"
                  className="max-h-48 rounded-md border object-contain"
                />
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={screenshotConsent}
                    onCheckedChange={(checked) => setScreenshotConsent(checked === true)}
                    aria-label="Consent to share screenshot"
                  />
                  <span>
                    I reviewed this screenshot and consent to share it. It may contain visible
                    screen content; file name and metadata have been removed.
                  </span>
                </label>
              </>
            ) : null}
          </div>

          <div className="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              Before submitting, remove message text, passwords, tokens, seeds, private keys, and
              personal addresses from your description and screenshot.
            </span>
          </div>

          {error ? (
            <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || processingScreenshot || steps.trim().length < 10}
            >
              {submitting ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Submit report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
