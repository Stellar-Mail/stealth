import React, { useState, useRef, useCallback } from "react";
import type { CalendarEvent, ExtractionSource } from "../types";

/**
 * ExtractionForm Component
 *
 * Accessible form for initiating and viewing calendar extractions.
 *
 * Accessibility features:
 * - Proper label association with form fields using htmlFor
 * - Required field indicators with aria-required
 * - Form validation with aria-invalid and error messages
 * - Keyboard navigation: Tab, Shift+Tab, Enter to submit, Escape to cancel
 * - Focus management and visible focus indicators
 * - fieldset and legend for source type grouping
 * - Screen reader friendly status updates
 * - aria-describedby linking fields to error messages
 */

interface ExtractionFormProps {
  event: CalendarEvent;
  onInitiateExtraction: (source: ExtractionSource) => void;
  onCancel: () => void;
  onRetry?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ExtractionForm({
  event,
  onInitiateExtraction,
  onCancel,
  onRetry,
  isLoading = false,
  error: externalError = null,
}: ExtractionFormProps) {
  const [source, setSource] = useState<ExtractionSource>("email");
  const [sourceRef, setSourceRef] = useState("");
  const [error, setError] = useState<string | null>(externalError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const sourceRefInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!source) {
        setError("Please select an extraction source");
        errorRef.current?.focus();
        return;
      }

      if ((source === "email" || source === "attachment") && !sourceRef.trim()) {
        setError("Please provide a source reference or description");
        sourceRefInputRef.current?.focus();
        return;
      }

      setError(null);
      setIsSubmitting(true);

      onInitiateExtraction(source);
    },
    [source, sourceRef, onInitiateExtraction],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLFormElement>) => {
      if (e.key === "Escape" && !isSubmitting && !isLoading) {
        onCancel();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && source && !isSubmitting && !isLoading) {
        formRef.current?.requestSubmit();
      }
    },
    [source, isSubmitting, isLoading, onCancel],
  );

  const sourceHelpText: Record<ExtractionSource, string> = {
    email: "Extract events from an email thread containing dates and times",
    calendar_link: "Import events from a shared calendar link or public URL",
    manual: "Manually create events by filling in the details",
    attachment: "Extract events from an attached file (PDF, DOCX, ICS)",
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="w-full max-w-2xl mx-auto space-y-6 p-4 rounded-lg border border-border bg-background"
      noValidate
    >
      {/* Event Details Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Event Details</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Title:</dt>
            <dd className="font-medium text-right">{event.title}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Date:</dt>
            <dd className="font-medium text-right">
              {new Date(event.startDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {event.allDay ? " (All day)" : ""}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Category:</dt>
            <dd className="font-medium capitalize text-right">{event.category}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Priority:</dt>
            <dd className="font-medium capitalize text-right">{event.priority}</dd>
          </div>
          {event.location && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Location:</dt>
              <dd className="text-right">{event.location}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Description:</dt>
            <dd className="text-right max-w-[60%]">{event.description}</dd>
          </div>
        </dl>
      </div>

      {/* Error State */}
      {(error || externalError) && (
        <div
          ref={errorRef}
          role="alert"
          aria-live="polite"
          tabIndex={-1}
          className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
        >
          {error || externalError}
        </div>
      )}

      {/* Source Selection */}
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">
          Extraction Source{" "}
          <span aria-label="required" className="text-destructive">
            *
          </span>
        </legend>

        <div className="space-y-3">
          {(["email", "calendar_link", "manual", "attachment"] as const).map((option) => (
            <div key={option} className="space-y-1">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:border-ring ${
                  source === option
                    ? "border-primary/50 bg-primary/5"
                    : "border-transparent hover:border-primary/20"
                }`}
              >
                <input
                  type="radio"
                  name="extraction-source"
                  value={option}
                  checked={source === option}
                  onChange={(e) => {
                    setSource(e.target.value as ExtractionSource);
                    setError(null);
                  }}
                  disabled={isSubmitting || isLoading}
                  className="w-4 h-4 cursor-pointer"
                  aria-describedby={`source-help-${option}`}
                />
                <div>
                  <span className="font-medium capitalize">{option.replace("_", " ")}</span>
                  <p id={`source-help-${option}`} className="text-xs text-muted-foreground mt-0.5">
                    {sourceHelpText[option]}
                  </p>
                </div>
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Source Reference Field */}
      {(source === "email" || source === "attachment") && (
        <div className="space-y-2">
          <label htmlFor="source-ref" className="block text-sm font-medium">
            Source Reference <span className="text-muted-foreground">(required)</span>
          </label>
          <input
            ref={sourceRefInputRef}
            id="source-ref"
            type="text"
            value={sourceRef}
            onChange={(e) => {
              setSourceRef(e.target.value);
              setError(null);
            }}
            disabled={isSubmitting || isLoading}
            placeholder={
              source === "email"
                ? "e.g., Email subject or thread ID..."
                : "e.g., filename.pdf, meeting-notes.docx..."
            }
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            aria-describedby="source-ref-help"
          />
          <p id="source-ref-help" className="text-xs text-muted-foreground">
            Provide a description or identifier for the source
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t border-border">
        {onRetry && error && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isSubmitting || isLoading}
            className="px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent text-foreground disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            Retry
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting || isLoading}
          className="px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent text-foreground disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          aria-label="Cancel extraction"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="px-4 py-2 rounded-lg font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Start calendar extraction"
        >
          {isSubmitting ? "Starting Extraction..." : "Start Extraction"}
        </button>
      </div>

      {/* Keyboard shortcuts info for screen readers */}
      <div className="sr-only" role="region" aria-label="Keyboard shortcuts">
        <p>Press Escape to cancel, or press Control+Enter to submit</p>
      </div>
    </form>
  );
}

export type { ExtractionFormProps };
