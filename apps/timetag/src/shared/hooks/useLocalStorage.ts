'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for localStorage with SSR-safe hydration
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  // Always start from initialValue to keep server/client first render consistent.
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const hasHydratedRef = useRef(false);

  // Read from localStorage only after mount.
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item) as T);
      } else {
        // Ensure localStorage has initial value for new keys.
        window.localStorage.setItem(key, JSON.stringify(initialValue));
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    } finally {
      hasHydratedRef.current = true;
    }
  }, [key]);

  // Persist changes after hydration is complete.
  useEffect(() => {
    if (!hasHydratedRef.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => (value instanceof Function ? value(prev) : value));
  }, []);

  return [storedValue, setValue];
}