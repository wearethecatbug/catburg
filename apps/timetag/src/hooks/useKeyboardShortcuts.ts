'use client';

import { useEffect, useCallback, useRef } from 'react';

interface KeyboardShortcuts {
  onAddFocus?: () => void;
  onSearchFocus?: () => void;
  onSearchClear?: () => void;
  onEscape?: () => void;
}

/**
 * Custom hook for keyboard shortcuts
 * - Ctrl+K / Cmd+K: Focus search
 * - Esc: Clear search / Close modals
 */
export function useKeyboardShortcuts({
  onAddFocus,
  onSearchFocus,
  onSearchClear,
  onEscape,
}: KeyboardShortcuts) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ctrl+K or Cmd+K: Focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        onSearchFocus?.();
        return;
      }

      // Escape: Clear search or close modals
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape?.();
        onSearchClear?.();
        return;
      }

      // Ctrl+N or Cmd+N: Focus add input
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        onAddFocus?.();
        return;
      }
    },
    [onAddFocus, onSearchFocus, onSearchClear, onEscape]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Hook to focus an input element
 */
export function useFocusRef<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  const focus = useCallback(() => {
    ref.current?.focus();
  }, []);

  return { ref, focus };
}

