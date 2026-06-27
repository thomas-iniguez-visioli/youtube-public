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

test('should handle heavy stress test of read/write operations', () => {
    clearCache();
    const iterations = 5000;
    
    // Rapid write of many elements
    for (let i = 0; i < iterations; i++) {
        setCachedSuggestions(`stress-key-${i}`, [{ id: `id-${i}`, title: `Title ${i}` }]);
    }
    
    // Verify eviction limits kept cache size within bounds (should not exceed 100 entries + buffer eviction margin)
    // Note that setCachedSuggestions deletes the first key when size > 100.
    // So the final cache should only contain keys from stress-key-(iterations-100) to stress-key-(iterations-1).
    const oldestPossibleKey = `stress-key-${iterations - 101}`;
    assert.strictEqual(getCachedSuggestions(oldestPossibleKey), null);
    
    const newestKey = `stress-key-${iterations - 1}`;
    assert.ok(getCachedSuggestions(newestKey) !== null);
});

test('should not have race conditions on concurrent async reads and writes', async () => {
    clearCache();
    const key = 'concurrent-key';
    
    const operations = [];
    
    // Simulate multiple concurrent microtasks trying to write and read the same key
    for (let i = 0; i < 100; i++) {
        operations.push((async (index) => {
            // Introduce slight randomized async deferral to test interleaving
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            setCachedSuggestions(key, [{ id: `val-${index}` }]);
            
            const readVal = getCachedSuggestions(key);
            assert.ok(readVal && readVal.length > 0);
            assert.ok(readVal[0].id.startsWith('val-'));
        })(i));
    }
    
    await Promise.all(operations);
    
    // Final value should be a valid latest written element
    const finalVal = getCachedSuggestions(key);
    assert.ok(finalVal && finalVal.length > 0);
});
