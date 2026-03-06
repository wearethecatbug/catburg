'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  initialValueRef.current = initialValue;

  // Read from localStorage after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsHydrated(false);

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item) as T);
      } else {
        window.localStorage.setItem(key, JSON.stringify(initialValueRef.current));
        setStoredValue(initialValueRef.current);
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      setStoredValue(initialValueRef.current);
    } finally {
      setIsHydrated(true);
    }
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;

        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
          }
        } catch (error) {
          console.error(`Error setting localStorage key "${key}":`, error);
        }

        return valueToStore;
      });
    },
    [key],
  );

  return [storedValue, setValue, isHydrated];
}