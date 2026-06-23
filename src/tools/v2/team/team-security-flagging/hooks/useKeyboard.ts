/**
 * Team Security Flagging Tool - Keyboard Navigation Hook
 *
 * Custom hook for managing keyboard shortcuts and navigation
 */

import { useEffect, useCallback, useRef } from "react";
import type { KeyboardShortcut } from "../types";
import { KEYBOARD_SHORTCUTS } from "../constants";
import { announce } from "../utils/accessibility";

interface UseKeyboardOptions {
  enabled?: boolean;
  onSearch?: () => void;
  onNewFlag?: () => void;
  onRefresh?: () => void;
  onToggleFilters?: () => void;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
  onOpenSelected?: () => void;
  onCloseDialog?: () => void;
}

/**
 * Custom hook for keyboard shortcuts
 */
export function useKeyboard(options: UseKeyboardOptions = {}) {
  const {
    enabled = true,
    onSearch,
    onNewFlag,
    onRefresh,
    onToggleFilters,
    onNavigateNext,
    onNavigatePrev,
    onOpenSelected,
    onCloseDialog,
  } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle shortcuts when typing in inputs (except for Escape)
    if (
      event.key !== "Escape" &&
      (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement)
    ) {
      return;
    }

    const { current: opts } = optionsRef;

    // Search (/)
    if (event.key === KEYBOARD_SHORTCUTS.SEARCH && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      opts.onSearch?.();
      announce("Search focused");
    }

    // New flag (N or n)
    if (
      (event.key === KEYBOARD_SHORTCUTS.NEW_FLAG || event.key === "N") &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      opts.onNewFlag?.();
      announce("Create new flag dialog opened");
    }

    // Refresh (R or r)
    if (
      (event.key === KEYBOARD_SHORTCUTS.REFRESH || event.key === "R") &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      opts.onRefresh?.();
      announce("Refreshing flags");
    }

    // Toggle filters (F or f)
    if (
      (event.key === KEYBOARD_SHORTCUTS.TOGGLE_FILTERS || event.key === "F") &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      opts.onToggleFilters?.();
      announce("Filters toggled");
    }

    // Navigate next (J or j or ArrowDown)
    if (
      (event.key === KEYBOARD_SHORTCUTS.NAVIGATE_NEXT ||
        event.key === "J" ||
        event.key === "ArrowDown") &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      opts.onNavigateNext?.();
    }

    // Navigate previous (K or k or ArrowUp)
    if (
      (event.key === KEYBOARD_SHORTCUTS.NAVIGATE_PREV ||
        event.key === "K" ||
        event.key === "ArrowUp") &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      opts.onNavigatePrev?.();
    }

    // Open selected (Enter)
    if (event.key === KEYBOARD_SHORTCUTS.OPEN_SELECTED && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      opts.onOpenSelected?.();
    }

    // Close dialog (Escape)
    if (event.key === KEYBOARD_SHORTCUTS.CLOSE_DIALOG) {
      event.preventDefault();
      opts.onCloseDialog?.();
    }

    // Help (?)
    if (event.key === "?" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      announceKeyboardShortcuts();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: KEYBOARD_SHORTCUTS,
  };
}

/**
 * Announce available keyboard shortcuts
 */
function announceKeyboardShortcuts() {
  const shortcuts = [
    "Press slash to search",
    "Press N to create a new flag",
    "Press R to refresh",
    "Press F to toggle filters",
    "Press J or down arrow to navigate to next item",
    "Press K or up arrow to navigate to previous item",
    "Press Enter to open selected item",
    "Press Escape to close dialogs",
  ];

  announce(`Available keyboard shortcuts: ${shortcuts.join(". ")}`);
}

/**
 * Hook for managing focus within a list
 */
export function useListNavigation<T>(items: T[], onSelect?: (item: T) => void) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLElement | null>(null);

  const focusItem = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length) return;

      setFocusedIndex(index);

      // Focus the element
      if (listRef.current) {
        const itemElements = listRef.current.querySelectorAll('[role="listitem"]');
        const element = itemElements[index] as HTMLElement;
        element?.focus();
      }

      // Announce to screen reader
      announce(`Item ${index + 1} of ${items.length}`);
    },
    [items.length],
  );

  const navigateNext = useCallback(() => {
    const nextIndex = Math.min(focusedIndex + 1, items.length - 1);
    focusItem(nextIndex);
  }, [focusedIndex, items.length, focusItem]);

  const navigatePrev = useCallback(() => {
    const prevIndex = Math.max(focusedIndex - 1, 0);
    focusItem(prevIndex);
  }, [focusedIndex, focusItem]);

  const selectFocused = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < items.length) {
      const item = items[focusedIndex];
      onSelect?.(item);
      announce("Item selected");
    }
  }, [focusedIndex, items, onSelect]);

  return {
    focusedIndex,
    listRef,
    focusItem,
    navigateNext,
    navigatePrev,
    selectFocused,
  };
}

/**
 * Hook for managing dialog focus
 */
export function useDialogFocus(isOpen: boolean) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Save currently focused element
      previouslyFocusedRef.current = document.activeElement as HTMLElement;

      // Focus dialog
      if (dialogRef.current) {
        const firstFocusable = dialogRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      }
    } else {
      // Restore focus
      previouslyFocusedRef.current?.focus();
    }
  }, [isOpen]);

  return dialogRef;
}

// Import useState for useListNavigation
import { useState } from "react";
