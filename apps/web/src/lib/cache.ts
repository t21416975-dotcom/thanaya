/**
 * Smart In-Memory TTL Cache Layer
 * Provides sub-millisecond access to repeated queries
 * Automatically revalidates expired data
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SmartMemoryCache {
  private store = new Map<string, CacheEntry<any>>();

  /**
   * Get cached item or null if expired/not found
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set item in cache with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Wrap an async fetcher with smart caching
   */
  async wrap<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    try {
      const fresh = await fetcher();
      this.set(key, fresh, ttlSeconds);
      return fresh;
    } catch (err) {
      // If fetcher fails and we had stale cache, or rethrow
      throw err;
    }
  }

  /**
   * Invalidate specific key or keys starting with prefix
   */
  invalidate(keyOrPrefix?: string): void {
    if (!keyOrPrefix) {
      this.store.clear();
      return;
    }

    for (const key of this.store.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
  }
}

export const smartCache = new SmartMemoryCache();
