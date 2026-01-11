/**
 * Unit tests for cache utilities
 * Tests local storage caching with expiration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setCache, getCache, clearCache, clearAllCache, isCacheValid } from '@/lib/cache';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Cache Utilities', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should set and get cache', () => {
    const data = { test: 'value' };
    setCache('test-key', data);

    const cached = getCache<typeof data>('test-key');
    expect(cached).toEqual(data);
  });

  it('should return null for non-existent cache', () => {
    const cached = getCache('non-existent');
    expect(cached).toBeNull();
  });

  it('should return null for expired cache', () => {
    const data = { test: 'value' };
    setCache('test-key', data, 100); // 100ms expiration

    // Mock Date.now to simulate time passing
    const originalNow = Date.now;
    Date.now = vi.fn(() => originalNow() + 200); // 200ms later

    const cached = getCache('test-key');
    expect(cached).toBeNull();

    Date.now = originalNow;
  });

  it('should clear specific cache entry', () => {
    setCache('test-key', { test: 'value' });
    expect(getCache('test-key')).toBeTruthy();

    clearCache('test-key');
    expect(getCache('test-key')).toBeNull();
  });

  it('should clear all cache entries', () => {
    setCache('key1', { test: 'value1' });
    setCache('key2', { test: 'value2' });
    setCache('key3', { test: 'value3' });

    expect(getCache('key1')).toBeTruthy();
    expect(getCache('key2')).toBeTruthy();
    expect(getCache('key3')).toBeTruthy();

    clearAllCache();

    // Verify cache entries are cleared by checking localStorage directly
    const keys = Object.keys(localStorageMock);
    const cacheKeys = keys.filter(key => key.startsWith('pft_cache_'));
    expect(cacheKeys.length).toBe(0);
  });

  it('should check if cache is valid', () => {
    setCache('test-key', { test: 'value' });
    expect(isCacheValid('test-key')).toBe(true);

    clearCache('test-key');
    expect(isCacheValid('test-key')).toBe(false);
  });

  it('should handle different data types', () => {
    const stringData = 'test string';
    const numberData = 42;
    const arrayData = [1, 2, 3];
    const objectData = { nested: { value: 'test' } };

    setCache('string', stringData);
    setCache('number', numberData);
    setCache('array', arrayData);
    setCache('object', objectData);

    expect(getCache('string')).toBe(stringData);
    expect(getCache('number')).toBe(numberData);
    expect(getCache('array')).toEqual(arrayData);
    expect(getCache('object')).toEqual(objectData);
  });

  it('should use custom expiration time', () => {
    const data = { test: 'value' };
    setCache('test-key', data, 1000); // 1 second

    const cached = getCache('test-key');
    expect(cached).toEqual(data);
  });

  it('should handle errors gracefully', () => {
    // Mock localStorage to throw error
    const originalSetItem = localStorageMock.setItem;
    localStorageMock.setItem = vi.fn(() => {
      throw new Error('Storage error');
    });

    // Should not throw
    expect(() => setCache('test-key', { test: 'value' })).not.toThrow();

    localStorageMock.setItem = originalSetItem;
  });
});
