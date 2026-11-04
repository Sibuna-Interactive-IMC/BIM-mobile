import { render } from '@testing-library/react-native';
import React from 'react';

/**
 * Custom renderHook implementation for React Native testing.
 * 
 * This is a replacement for @testing-library/react's renderHook which requires jsdom.
 * It works with @testing-library/react-native in the React Native Jest environment.
 * 
 * @param callback - The hook to test
 * @param options - Optional configuration including a wrapper component
 * @returns An object containing the hook result and utility functions
 * 
 * @example
 * ```tsx
 * const { result } = renderHook(() => useMyHook(), { 
 *   wrapper: ({ children }) => <MyProvider>{children}</MyProvider> 
 * });
 * 
 * expect(result.current.someValue).toBe(expectedValue);
 * ```
 */
export function renderHook<T>(
  callback: () => T,
  options?: { wrapper?: React.ComponentType<{ children: React.ReactNode }> }
) {
  const result = { current: null as T };
  
  function TestComponent() {
    result.current = callback();
    return null;
  }
  
  const Wrapper = options?.wrapper;
  const component = Wrapper ? (
    <Wrapper>
      <TestComponent />
    </Wrapper>
  ) : (
    <TestComponent />
  );
  
  const renderResult = render(component);
  
  return {
    result,
    rerender: (newCallback?: () => T) => {
      if (newCallback) {
        // Update the callback and re-render
        renderResult.rerender(component);
      }
    },
    unmount: renderResult.unmount,
  };
}
