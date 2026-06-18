/**
 * Team Security Flagging Tool - Error State Component
 *
 * Displays error messages with recovery options
 */

import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  error: Error | string;
  title?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  variant?: "page" | "inline";
  className?: string;
}

export function ErrorState({
  error,
  title = "Something went wrong",
  onRetry,
  onGoBack,
  variant = "page",
  className,
}: ErrorStateProps) {
  const errorMessage = typeof error === "string" ? error : error.message;

  // Determine error type and provide helpful messaging
  const errorContext = getErrorContext(errorMessage);

  if (variant === "inline") {
    return (
      <div
        className={cn("rounded-lg border border-destructive/20 bg-destructive/5 p-4", className)}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-destructive">{title}</p>
            <p className="text-sm text-muted-foreground">{errorContext.message}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mt-2"
                aria-label="Try again"
              >
                <RefreshCw className="size-4 mr-2" aria-hidden="true" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Page variant (default)
  return (
    <div
      className={cn("mx-auto flex max-w-md flex-col items-center text-center py-12", className)}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div
        className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20"
        aria-hidden="true"
      >
        <AlertCircle className="size-6" />
      </div>

      {/* Eyebrow */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Error
      </p>

      {/* Title */}
      <h2 className="mt-2 text-2xl font-semibold text-foreground">{title}</h2>

      {/* Description */}
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{errorContext.message}</p>

      {/* Technical details (collapsible) */}
      {errorContext.showTechnical && (
        <details className="mt-4 w-full text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Technical details
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {errorMessage}
          </pre>
        </details>
      )}

      {/* Suggestions */}
      {errorContext.suggestions.length > 0 && (
        <div className="mt-4 w-full rounded-lg border border-border bg-muted/30 p-4 text-left">
          <p className="text-xs font-medium text-foreground mb-2">What you can try:</p>
          <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
            {errorContext.suggestions.map((suggestion, i) => (
              <li key={i}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-7 flex gap-2">
        {onRetry && (
          <Button onClick={onRetry} aria-label="Try again">
            <RefreshCw className="size-4 mr-2" aria-hidden="true" />
            Try Again
          </Button>
        )}
        {onGoBack && (
          <Button variant="outline" onClick={onGoBack} aria-label="Go back to previous page">
            <Home className="size-4 mr-2" aria-hidden="true" />
            Go Back
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Analyze error and provide context-aware messaging
 */
function getErrorContext(errorMessage: string): {
  message: string;
  suggestions: string[];
  showTechnical: boolean;
} {
  const lower = errorMessage.toLowerCase();

  // Network errors
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("connection")) {
    return {
      message:
        "Unable to connect to the server. Please check your internet connection and try again.",
      suggestions: [
        "Check your internet connection",
        "Verify the server is accessible",
        "Try again in a few moments",
      ],
      showTechnical: true,
    };
  }

  // Permission errors
  if (
    lower.includes("permission") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden")
  ) {
    return {
      message:
        "You don't have permission to perform this action. Contact your team administrator if you need access.",
      suggestions: [
        "Verify you're signed in with the correct account",
        "Contact your administrator to request access",
        "Check if your session has expired",
      ],
      showTechnical: false,
    };
  }

  // Not found errors
  if (lower.includes("not found") || lower.includes("404")) {
    return {
      message: "The requested resource could not be found. It may have been moved or deleted.",
      suggestions: [
        "Check the URL is correct",
        "Go back and try again",
        "Contact support if the problem persists",
      ],
      showTechnical: false,
    };
  }

  // Validation errors
  if (lower.includes("validation") || lower.includes("invalid")) {
    return {
      message: "The provided data is invalid. Please check your input and try again.",
      suggestions: [
        "Review all required fields",
        "Check for any validation errors",
        "Ensure all data is in the correct format",
      ],
      showTechnical: true,
    };
  }

  // Server errors
  if (lower.includes("500") || lower.includes("server error")) {
    return {
      message:
        "The server encountered an error. This issue has been logged and will be investigated.",
      suggestions: [
        "Try again in a few minutes",
        "Contact support if the problem persists",
        "Check the status page for known issues",
      ],
      showTechnical: true,
    };
  }

  // Generic error
  return {
    message:
      "An unexpected error occurred. Please try again or contact support if the problem continues.",
    suggestions: [
      "Try refreshing the page",
      "Clear your browser cache",
      "Contact support with the technical details below",
    ],
    showTechnical: true,
  };
}
