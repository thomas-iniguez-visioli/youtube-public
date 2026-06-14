import assert from 'node:assert';
import { test } from 'node:test';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// In ESM, we can't easily mock require.cache for 'electron'
// So we rely on db.js falling back to process.cwd() or we could try to mock it if needed.
// For now, we'll just convert the file.

import FileDatabase from '../src/db.js';

test('FileDatabase should manage history correctly', (t) => {
    const userDataPath = path.resolve('./'); // Fallback in db.js when electron is missing
    const filesPath = path.resolve('./test-history-files');
    const dbFilePath = path.join(userDataPath, 'database.json');
    
    // Clean start
    if (fs.existsSync(dbFilePath)) fs.unlinkSync(dbFilePath);
    if (fs.existsSync(filesPath)) fs.rmSync(filesPath, { recursive: true, force: true });
    
    if (!fs.existsSync(filesPath)) fs.mkdirSync(filesPath, { recursive: true });
    
    const db = new FileDatabase(filesPath);
    
    // Add 10 dummy files to database
    for (let i = 0; i < 10; i++) {
        db.database.push({
            fileName: `test [v${i}].mp4`,
            fileUuid: `uuid-v${i}`,
            yid: `v${i}`,
            tags: []
        });
    }
    // Reconstruire l'index après insertion directe dans db.database
    db._buildIndex();
    
    // Add 8 items to history (80% of 10)
    for (let i = 0; i < 8; i++) {
        db.addToHistory(`v${i}`);
    }
    assert.strictEqual(db.history.length, 8);
    assert.strictEqual(db.history[0], "v7");
    
    // Add 9th item, it should pop the oldest one
    db.addToHistory("v8");
    assert.strictEqual(db.history.length, 8);
    assert.strictEqual(db.history[0], "v8");
    assert.strictEqual(db.history[7], "v1");
    assert.strictEqual(db.history.includes("v0"), false);
    
    // Move existing item to front
    db.addToHistory("v1");
    assert.strictEqual(db.history.length, 8);
    assert.strictEqual(db.history[0], "v1");
    
    const historyItems = db.getHistory();
    assert.strictEqual(historyItems.length, 8);
    assert.strictEqual(historyItems[0].yid, "v1");
    
    // Clean up
    if (fs.existsSync(dbFilePath)) fs.unlinkSync(dbFilePath);
    fs.rmSync(filesPath, { recursive: true, force: true });
});
