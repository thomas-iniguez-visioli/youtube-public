const suggestionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

export function getCachedSuggestions(key) {
  const cached = suggestionCache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  return null;
}

export function setCachedSuggestions(key, data) {
  suggestionCache.set(key, { data, timestamp: Date.now() });
  if (suggestionCache.size > 100) {
    const firstKey = suggestionCache.keys().next().value;
    suggestionCache.delete(firstKey);
  }
}

export function clearCache() {
  suggestionCache.clear();
}
