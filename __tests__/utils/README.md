# Test Utilities

This directory contains reusable testing utilities for the BIM Mobile application.

## `renderHook.tsx`

A custom implementation of `renderHook` for React Native testing environments.

### Why This Exists

`@testing-library/react-native` v13+ removed the `renderHook` export. While `@testing-library/react` provides `renderHook`, it requires a jsdom environment which conflicts with React Native's Jest setup. This utility provides a React Native-compatible alternative.

### Usage

```tsx
import { renderHook } from './utils/renderHook';
import { act } from 'react-test-renderer';

// Basic usage
const { result } = renderHook(() => useMyHook());
expect(result.current.someValue).toBe(expectedValue);

// With a provider wrapper
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MyProvider>{children}</MyProvider>
);

const { result } = renderHook(() => useMyHook(), { wrapper });

// With async operations
await act(async () => {
  await result.current.someAsyncFunction();
});

expect(result.current.updatedValue).toBe(newValue);
```

### API

- **`callback`**: The hook function to test
- **`options.wrapper`**: Optional wrapper component (e.g., context providers)
- **Returns**: Object with:
  - `result.current`: The current return value of the hook
  - `rerender()`: Function to trigger a re-render
  - `unmount()`: Function to unmount the component
