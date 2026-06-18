/**
 * Team Security Flagging Tool - Success State Component
 *
 * Displays success feedback for completed actions
 */

import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface SuccessStateProps {
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
  variant?: "toast" | "page" | "inline";
  autoClose?: boolean;
  autoCloseDelay?: number;
  className?: string;
}

export function SuccessState({
  title,
  message,
  action,
  onClose,
  variant = "toast",
  autoClose = false,
  autoCloseDelay = 5000,
  className,
}: SuccessStateProps) {
  // Auto-close functionality
  useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, onClose]);

  if (variant === "toast") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 shadow-lg",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-900">{title}</p>
          {message && <p className="mt-1 text-sm text-green-700">{message}</p>}
          {action && (
            <Button
              variant="link"
              size="sm"
              onClick={action.onClick}
              className="mt-2 h-auto p-0 text-green-700 hover:text-green-900"
            >
              {action.label}
            </Button>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-6 shrink-0 text-green-700 hover:text-green-900 hover:bg-green-100"
            aria-label="Close notification"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div
        className={cn("rounded-lg border border-green-200 bg-green-50 p-4", className)}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">{title}</p>
            {message && <p className="mt-1 text-sm text-green-700">{message}</p>}
            {action && (
              <Button variant="outline" size="sm" onClick={action.onClick} className="mt-3">
                {action.label}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Page variant
  return (
    <div
      className={cn("mx-auto flex max-w-md flex-col items-center text-center py-12", className)}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      <div
        className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-green-50 text-green-600 border border-green-200"
        aria-hidden="true"
      >
        <CheckCircle2 className="size-6" />
      </div>

      {/* Eyebrow */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Success
      </p>

      {/* Title */}
      <h2 className="mt-2 text-2xl font-semibold text-foreground">{title}</h2>

      {/* Message */}
      {message && <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>}

      {/* Action */}
      {action && (
        <div className="mt-7">
          <Button onClick={action.onClick}>{action.label}</Button>
        </div>
      )}
    </div>
  );
}

/**
 * Success banner for non-blocking feedback
 */
export function SuccessBanner({
  message,
  onClose,
  className,
}: {
  message: string;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-5 text-green-600" aria-hidden="true" />
        <p className="text-sm font-medium text-green-900">{message}</p>
      </div>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="size-6 text-green-700 hover:text-green-900 hover:bg-green-100"
          aria-label="Dismiss notification"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
