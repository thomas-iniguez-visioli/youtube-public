export class SuggestionCache {
  constructor(ttl = 5 * 60 * 1000, maxSize = 100) {
    this.cache = new Map();
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  get(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp < this.ttl)) {
      return cached.data;
    }
    return null;
  }

  set(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  clear() {
    this.cache.clear();
  }
}
