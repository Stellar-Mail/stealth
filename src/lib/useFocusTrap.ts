import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * Traps keyboard focus inside the referenced element while active.
 *
 * - Focuses the first focusable child on mount (or the container itself).
 * - Wraps Tab / Shift+Tab within the container.
 * - Calls `onClose` when Escape is pressed.
 * - Restores focus to the previously-focused element on unmount.
 */
export function useFocusTrap(active: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Save the element that was focused before the trap activated
    previousFocusRef.current = globalThis.document.activeElement as HTMLElement | null;

    // Focus the first focusable element inside the container
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !container) return;

      const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (globalThis.document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (globalThis.document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    globalThis.document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      globalThis.document.removeEventListener("keydown", handleKeyDown, true);

      // Restore focus to the previously focused element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [active, onClose]);

  return containerRef;
}
