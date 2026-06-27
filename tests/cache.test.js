import assert from 'node:assert';
import { test } from 'node:test';
import { getCachedSuggestions, setCachedSuggestions, clearCache } from '../src/suggestionCache.js';

test('should return null for cache miss', () => {
    clearCache();
    const data = getCachedSuggestions('non-existent-key');
    assert.strictEqual(data, null);
});

test('should set and get cache hit before TTL expiration', () => {
    clearCache();
    const testData = [{ id: '123', title: 'Test Video' }];
    setCachedSuggestions('test-key', testData);
    
    const data = getCachedSuggestions('test-key');
    assert.deepStrictEqual(data, testData);
});

test('should expire cache after TTL size limit', () => {
    clearCache();
    const testData = [{ id: '456', title: 'Expired Video' }];
    
    setCachedSuggestions('expire-key', testData);
    
    // We add more than 100 entries to check size limit eviction.
    for (let i = 0; i <= 100; i++) {
        setCachedSuggestions(`key-${i}`, [{ id: `${i}` }]);
    }
    
    // First key should be evicted because size exceeds 100
    const evicted = getCachedSuggestions('expire-key');
    assert.strictEqual(evicted, null);
});
