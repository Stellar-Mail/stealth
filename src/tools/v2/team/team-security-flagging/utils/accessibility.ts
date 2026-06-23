/**
 * Team Security Flagging Tool - Accessibility Utilities
 *
 * Helper functions for managing accessibility features
 */

import type { A11yAnnouncement } from "../types";

/**
 * Create or get the live region for screen reader announcements
 */
function getLiveRegion(priority: "polite" | "assertive" = "polite"): HTMLElement {
  const id = `sr-live-region-${priority}`;
  let region = document.getElementById(id);

  if (!region) {
    region = document.createElement("div");
    region.id = id;
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", priority);
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only absolute -left-[10000px] h-[1px] w-[1px] overflow-hidden";
    document.body.appendChild(region);
  }

  return region;
}

/**
 * Announce a message to screen readers
 */
export function announce(message: string, priority: "polite" | "assertive" = "polite"): void {
  const region = getLiveRegion(priority);

  // Clear and set message with a small delay to ensure it's announced
  region.textContent = "";
  setTimeout(() => {
    region.textContent = message;
  }, 100);
}

/**
 * Generate a unique ID for accessibility purposes
 */
export function generateA11yId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Trap focus within a container (useful for modals/dialogs)
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableSelectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ");

  const focusableElements = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  }

  container.addEventListener("keydown", handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener("keydown", handleKeyDown);
  };
}

/**
 * Restore focus to a previous element
 */
export function createFocusManager() {
  let previouslyFocusedElement: HTMLElement | null = null;

  return {
    capture() {
      previouslyFocusedElement = document.activeElement as HTMLElement;
    },
    restore() {
      if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === "function") {
        previouslyFocusedElement.focus();
      }
    },
  };
}

/**
 * Check if an element is currently visible
 */
export function isElementVisible(element: HTMLElement): boolean {
  return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

/**
 * Get the accessible name of an element
 */
export function getAccessibleName(element: HTMLElement): string {
  // Check aria-label
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // Check aria-labelledby
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) return labelElement.textContent || "";
  }

  // Check associated label
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent || "";
  }

  // Fallback to text content
  return element.textContent || "";
}

/**
 * Create keyboard event handler with modifiers
 */
export function createKeyHandler(
  key: string,
  handler: (event: KeyboardEvent) => void,
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  },
) {
  return (event: KeyboardEvent) => {
    const matchesKey = event.key === key || event.code === key;
    const matchesCtrl = modifiers?.ctrl ? event.ctrlKey : !event.ctrlKey;
    const matchesAlt = modifiers?.alt ? event.altKey : !event.altKey;
    const matchesShift = modifiers?.shift ? event.shiftKey : !event.shiftKey;
    const matchesMeta = modifiers?.meta ? event.metaKey : !event.metaKey;

    if (matchesKey && matchesCtrl && matchesAlt && matchesShift && matchesMeta) {
      handler(event);
    }
  };
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Get contrast ratio between two colors
 * Simplified version - for production, use a proper color library
 */
export function getContrastRatio(foreground: string, background: string): number {
  // This is a placeholder - implement proper color contrast calculation
  // For production, use a library like polished or color
  return 4.5; // WCAG AA minimum
}

/**
 * Format number for screen readers
 */
export function formatNumberForSR(num: number): string {
  if (num === 0) return "zero";
  if (num === 1) return "one";
  return num.toString();
}

/**
 * Format date for screen readers
 */
export function formatDateForSR(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }

  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }

  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }

  const days = Math.floor(diffInSeconds / 86400);
  if (days < 7) {
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Create describedby relationship
 */
export function createDescribedBy(elementId: string, descriptionId: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    const existingDescribedBy = element.getAttribute("aria-describedby");
    if (existingDescribedBy) {
      element.setAttribute("aria-describedby", `${existingDescribedBy} ${descriptionId}`);
    } else {
      element.setAttribute("aria-describedby", descriptionId);
    }
  }
}

/**
 * Announce batch operation results
 */
export function announceBatchResult(
  operation: string,
  successCount: number,
  totalCount: number,
): void {
  if (successCount === totalCount) {
    announce(`${operation} completed successfully for all ${totalCount} items`);
  } else {
    announce(
      `${operation} completed: ${successCount} of ${totalCount} items successful`,
      "assertive",
    );
  }
}
