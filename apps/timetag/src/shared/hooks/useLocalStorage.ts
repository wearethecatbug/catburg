'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

let nextLocalStorageListenerId = 0;
const localStorageListeners = new Map<string, Map<number, () => void>>();

function subscribeToLocalStorageKey(key: string, id: number, listener: () => void) {
  const listenersForKey = localStorageListeners.get(key) ?? new Map<number, () => void>();
  listenersForKey.set(id, listener);
  localStorageListeners.set(key, listenersForKey);

  return () => {
    const currentListeners = localStorageListeners.get(key);
    if (!currentListeners) return;

    currentListeners.delete(id);
    if (currentListeners.size === 0) {
      localStorageListeners.delete(key);
    }
  };
}

function notifyLocalStorageKeyListeners(key: string, sourceId?: number) {
  const listenersForKey = localStorageListeners.get(key);
  if (!listenersForKey) return;

  listenersForKey.forEach((listener, id) => {
    if (id !== sourceId) {
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
  const storedValueRef = useRef(storedValue);
  const listenerIdRef = useRef<number | null>(null);
  initialValueRef.current = initialValue;
  storedValueRef.current = storedValue;

  if (typeof window !== 'undefined' && listenerIdRef.current === null) {
    nextLocalStorageListenerId += 1;
    listenerIdRef.current = nextLocalStorageListenerId;
  }

  const listenerId = listenerIdRef.current;

  const readStoredValue = useCallback(() => {
    if (typeof window === 'undefined') return initialValueRef.current;

    const item = window.localStorage.getItem(key);
    if (item !== null) {
      return JSON.parse(item) as T;
    }

    window.localStorage.setItem(key, JSON.stringify(initialValueRef.current));
    return initialValueRef.current;
  }, [key]);

  // Read from localStorage after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsHydrated(false);

    try {
      setStoredValue(readStoredValue());
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      setStoredValue(initialValueRef.current);
    } finally {
      setIsHydrated(true);
    }
  }, [key, readStoredValue]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (listenerId === null) return;

    const syncFromStorage = () => {
      try {
        const nextValue = readStoredValue();
        setStoredValue(nextValue);
        storedValueRef.current = nextValue;
      } catch (error) {
        console.error(`Error syncing localStorage key "${key}":`, error);
        setStoredValue(initialValueRef.current);
        storedValueRef.current = initialValueRef.current;
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      syncFromStorage();
    };

    const unsubscribe = subscribeToLocalStorageKey(key, listenerId, syncFromStorage);

    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, [key, listenerId, readStoredValue]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      const valueToStore = value instanceof Function ? value(storedValueRef.current) : value;

      setStoredValue(valueToStore);
      storedValueRef.current = valueToStore;

      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          if (listenerId !== null) {
            notifyLocalStorageKeyListeners(key, listenerId);
          }
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, listenerId],
  );

  return [storedValue, setValue, isHydrated];
}