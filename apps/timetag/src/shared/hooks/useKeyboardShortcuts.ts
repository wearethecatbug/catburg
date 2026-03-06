'use client';

import { useEffect, useCallback, useRef } from 'react';

interface KeyboardShortcuts {
  onAddFocus?: () => void;
  onSearchFocus?: () => void;
  onSearchClear?: () => void;
  onEscape?: () => void;
}

/**
 * Keyboard shortcuts:
 * - Ctrl+K / Cmd+K: Focus search
 * - Ctrl+N / Cmd+N: Focus add input
 * - Esc: Clear search / close modals
 */
export function useKeyboardShortcuts({
  onAddFocus,
  onSearchFocus,
  onSearchClear,
  onEscape,
}: KeyboardShortcuts) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        onSearchFocus?.();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape?.();
        onSearchClear?.();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        onAddFocus?.();
        return;
      }
    },
    [onAddFocus, onSearchFocus, onSearchClear, onEscape],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook to get a ref that can be focused programmatically
 */
export function useFocusRef<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const focus = useCallback(() => ref.current?.focus(), []);
  return { ref, focus };
}

