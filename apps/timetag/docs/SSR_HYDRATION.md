# SSR Hydration & localStorage

## Problem

Next.js performs Server-Side Rendering (SSR), which means components are first rendered on the server (where `localStorage` is not available), then "hydrated" on the client.

**Hydration mismatch** occurs when:
1. Server renders HTML with one state
2. Client hydrates with different state (e.g., from localStorage)
3. React detects mismatch → Error + full re-render

## ❌ Wrong Pattern

```tsx
// BAD: reads localStorage during state initialization
const [state, setState] = useState(() => {
  const item = localStorage.getItem('key');
  return item ? JSON.parse(item) : defaultValue;
});
```

**Why it fails:**
- Server: `localStorage` is undefined → returns `defaultValue`
- Client: `localStorage` exists → returns stored value
- Result: HTML mismatch → hydration error

## ✅ Correct Pattern

```tsx
// GOOD: always initialize with defaultValue, read in useEffect
const [state, setState] = useState(defaultValue);

useEffect(() => {
  const item = localStorage.getItem('key');
  if (item) {
    setState(JSON.parse(item));
  }
}, []);
```

**Why it works:**
- Server & Client both start with `defaultValue`
- After hydration, `useEffect` runs only on client
- State updates from localStorage after initial render
- No mismatch, no error

## Implementation in TimeTag

### 1. `useLocalStorage` Hook

Located: `src/shared/hooks/useLocalStorage.ts`

```tsx
export function useLocalStorage<T>(key: string, initialValue: T) {
  // Always start with initialValue (SSR-safe)
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Read from localStorage only after mount (client-side)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item) as T);
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // ... setValue logic
}
```

### 2. WorkspaceSwitch Component

Located: `src/features/workspace-switch/WorkspaceSwitch.tsx`

```tsx
export function WorkspaceSwitch() {
  // Initialize with DEFAULT_USER_WORKSPACES for SSR
  const [userWorkspaces, setUserWorkspaces] = useState(DEFAULT_USER_WORKSPACES);

  // Load from localStorage after mount (client-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setUserWorkspaces(parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Keep localStorage in sync
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(userWorkspaces));
    } catch {
      // ignore write errors
    }
  }, [userWorkspaces]);
}
```

### 3. TaskProvider Component

Located: `src/store/task.store.tsx`

**Problem:** Using `savedTasks` from `useLocalStorage` directly in `useReducer` initial state.

```tsx
// ❌ BAD: causes hydration mismatch
const [savedTasks, setSavedTasks] = useLocalStorage<Task[]>('timetag-tasks', []);
const [state, dispatch] = useReducer(taskReducer, { ...initialState, tasks: savedTasks });
```

**Why it fails:**
- Server: `savedTasks = []` (default value)
- Client mount: `savedTasks` still `[]` initially
- After useLocalStorage effect: `savedTasks = [task1, task2, ...]`
- Result: state initializes differently on server vs client

**Solution:**

```tsx
// ✅ GOOD: always initialize with empty state
export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [savedTasks, setSavedTasks] = useLocalStorage<Task[]>('timetag-tasks', []);
  
  // Always initialize with empty tasks (SSR-safe)
  const [state, dispatch] = useReducer(taskReducer, initialState);
  
  // Track if we've loaded from localStorage
  const hasLoadedRef = useRef(false);

  // Persist to localStorage
  useEffect(() => {
    // Only persist if we've already loaded (avoid overwriting on first render)
    if (hasLoadedRef.current) {
      setSavedTasks(state.tasks);
    }
  }, [state.tasks, setSavedTasks]);

  // Hydrate from localStorage on mount (client-side only)
  useEffect(() => {
    if (!hasLoadedRef.current && savedTasks.length > 0) {
      dispatch({ type: 'SET_TASKS', payload: savedTasks });
      hasLoadedRef.current = true;
    }
  }, [savedTasks]);

  // ...rest of component
}
```

**Key points:**
- `useReducer` always gets `initialState` (empty tasks)
- Tasks load via `SET_TASKS` action after mount
- `hasLoadedRef` prevents re-loading and premature persistence
- Server and client render identical HTML initially

## Rules for SSR Components

1. **Never access `window` or `localStorage` during render or state initialization**
2. **Always use `useEffect` for client-only logic**
3. **Initialize state with SSR-safe default values**
4. **Use `typeof window !== 'undefined'` check if needed**
5. **Prefer custom hooks like `useLocalStorage` for consistency**

## Testing for Hydration Issues

1. Run dev server: `npm run dev`
2. Open DevTools Console
3. Look for "Hydration failed" errors
4. Check for mismatched HTML warnings

## References

- [Next.js Hydration Errors](https://nextjs.org/docs/messages/react-hydration-error)
- [React Hydration](https://react.dev/reference/react-dom/client/hydrateRoot)

