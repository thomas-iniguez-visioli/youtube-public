import assert from 'node:assert';
import { test } from 'node:test';
import { SuggestionCache } from '../src/suggestionCache.js';

test('should return null for cache miss', () => {
    const cache = new SuggestionCache();
    const data = cache.get('non-existent-key');
    assert.strictEqual(data, null);
});

test('should set and get cache hit before TTL expiration', () => {
    const cache = new SuggestionCache();
    const testData = [{ id: '123', title: 'Test Video' }];
    cache.set('test-key', testData);
    
    const data = cache.get('test-key');
    assert.deepStrictEqual(data, testData);
});

test('should expire cache after TTL size limit', () => {
    const cache = new SuggestionCache();
    const testData = [{ id: '456', title: 'Expired Video' }];
    
    cache.set('expire-key', testData);
    
    // We add more than 100 entries to check size limit eviction.
    for (let i = 0; i <= 100; i++) {
        cache.set(`key-${i}`, [{ id: `${i}` }]);
    }
    
    // First key should be evicted because size exceeds 100
    const evicted = cache.get('expire-key');
    assert.strictEqual(evicted, null);
});

test('should handle heavy stress test of read/write operations', () => {
    const cache = new SuggestionCache();
    const iterations = 5000;
    
    // Rapid write of many elements
    for (let i = 0; i < iterations; i++) {
        cache.set(`stress-key-${i}`, [{ id: `id-${i}`, title: `Title ${i}` }]);
    }
    
    // Verify eviction limits kept cache size within bounds
    const oldestPossibleKey = `stress-key-${iterations - 101}`;
    assert.strictEqual(cache.get(oldestPossibleKey), null);
    
    const newestKey = `stress-key-${iterations - 1}`;
    assert.ok(cache.get(newestKey) !== null);
});

test('should not have race conditions on concurrent async reads and writes', async () => {
    const cache = new SuggestionCache();
    const key = 'concurrent-key';
    
    const operations = [];
    
    // Simulate multiple concurrent microtasks trying to write and read the same key
    for (let i = 0; i < 100; i++) {
        operations.push((async (index) => {
            // Introduce slight randomized async deferral to test interleaving
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            cache.set(key, [{ id: `val-${index}` }]);
            
            const readVal = cache.get(key);
            assert.ok(readVal && readVal.length > 0);
            assert.ok(readVal[0].id.startsWith('val-'));
        })(i));
    }
    
    await Promise.all(operations);
    
    // Final value should be a valid latest written element
    const finalVal = cache.get(key);
    assert.ok(finalVal && finalVal.length > 0);
});
