/**
 * Local storage cache utilities for analytics data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

const CACHE_PREFIX = 'pft_cache_';

/**
 * Set data in cache with expiration
 * @param key - Cache key
 * @param data - Data to cache
 * @param expiresIn - Expiration time in milliseconds (default: 5 minutes)
 */
export function setCache<T>(key: string, data: T, expiresIn: number = 5 * 60 * 1000): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresIn,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (error) {
    console.error('Error setting cache:', error);
  }
}

/**
 * Get data from cache if not expired
 * @param key - Cache key
 * @returns Cached data or null if expired/not found
 */
export function getCache<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const entry: CacheEntry<T> = JSON.parse(item);
    const now = Date.now();

    // Check if cache is expired
    if (now - entry.timestamp > entry.expiresIn) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
}

/**
 * Clear specific cache entry
 * @param key - Cache key
 */
export function clearCache(key: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
}

/**
 * Check if cache exists and is valid
 * @param key - Cache key
 * @returns true if cache exists and is not expired
 */
export function isCacheValid(key: string): boolean {
  return getCache(key) !== null;
}
