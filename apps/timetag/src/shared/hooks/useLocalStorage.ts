'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const localStorageListeners = new Map<string, Set<() => void>>();

function subscribeToLocalStorageKey(key: string, listener: () => void) {
  const listenersForKey = localStorageListeners.get(key) ?? new Set<() => void>();
  listenersForKey.add(listener);
  localStorageListeners.set(key, listenersForKey);

  return () => {
    const currentListeners = localStorageListeners.get(key);
    if (!currentListeners) return;

    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      localStorageListeners.delete(key);
    }
  };
}

function notifyLocalStorageKeyListeners(key: string, sourceListener?: () => void) {
  const listenersForKey = localStorageListeners.get(key);
  if (!listenersForKey) return;

  listenersForKey.forEach((listener) => {
    if (listener !== sourceListener) {
      listener();
    }
  });
}

/**
 * Custom hook for localStorage with SSR-safe hydration
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  // Keep server render and client first render identical.
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const initialValueRef = useRef(initialValue);
  const storedValueRef = useRef(initialValue);
  const listenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  const readStoredValue = useCallback((initializeMissing = true) => {
    if (typeof window === 'undefined') return initialValueRef.current;

    const item = window.localStorage.getItem(key);
    if (item !== null) {
      return JSON.parse(item) as T;
    }

    if (initializeMissing) {
      window.localStorage.setItem(key, JSON.stringify(initialValueRef.current));
    }

    return initialValueRef.current;
  }, [key]);

  // Read from localStorage after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsHydrated(false);

    try {
      const nextValue = readStoredValue();
      storedValueRef.current = nextValue;
      setStoredValue(nextValue);
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      const fallback = initialValueRef.current;
      storedValueRef.current = fallback;
      setStoredValue(fallback);
    } finally {
      setIsHydrated(true);
    }
  }, [key, readStoredValue]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromStorage = () => {
      try {
        const nextValue = readStoredValue(false);
        setStoredValue(nextValue);
        storedValueRef.current = nextValue;
      } catch (error) {
        console.error(`Error syncing localStorage key "${key}":`, error);
        setStoredValue(initialValueRef.current);
        storedValueRef.current = initialValueRef.current;
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) return;
      syncFromStorage();
    };

    listenerRef.current = syncFromStorage;
    const unsubscribe = subscribeToLocalStorageKey(key, syncFromStorage);

    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      if (listenerRef.current === syncFromStorage) {
        listenerRef.current = null;
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [key, readStoredValue]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      const valueToStore = value instanceof Function ? value(storedValueRef.current) : value;

      setStoredValue(valueToStore);
      storedValueRef.current = valueToStore;

      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          notifyLocalStorageKeyListeners(key, listenerRef.current ?? undefined);
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key],
  );

  return [storedValue, setValue, isHydrated];
}
