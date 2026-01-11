/**
 * Unit tests for useDebounce hook
 * Tests debouncing functionality with different delays
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/use-debounce';

describe('useDebounce Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    expect(result.current).toBe('initial');

    // Update value
    act(() => {
      rerender({ value: 'updated', delay: 300 });
    });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current).toBe('updated');
  });

  it('should cancel previous timeout on rapid changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    // Rapid updates
    act(() => {
      rerender({ value: 'first', delay: 300 });
    });
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    act(() => {
      rerender({ value: 'second', delay: 300 });
    });
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    act(() => {
      rerender({ value: 'third', delay: 300 });
    });

    // Value should still be initial
    expect(result.current).toBe('initial');

    // Complete the delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current).toBe('third');
  });

  it('should work with custom delay', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    act(() => {
      rerender({ value: 'updated', delay: 500 });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    
    expect(result.current).toBe('initial');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current).toBe('updated');
  });

  it('should work with different value types', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 300 } }
    );

    expect(result.current).toBe(0);

    act(() => {
      rerender({ value: 42, delay: 300 });
    });
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current).toBe(42);
  });
});
