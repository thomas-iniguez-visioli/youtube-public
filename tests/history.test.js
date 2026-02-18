const assert = require('node:assert');
const { test } = require('node:test');
const path = require('path');
const fs = require('fs');

// Mock electron app before requiring db.js
const mockApp = {
    getPath: (name) => {
        if (name === 'userData') return './test-history-userdata';
        return './test-dir';
    }
};

// Use a proxy or mock for electron
require.cache[require.resolve('electron')] = {
    cache: {},
    exports: {
        app: mockApp
    }
};

const FileDatabase = require('../src/db.js');

test('FileDatabase should manage history correctly', (t) => {
    const userDataPath = path.resolve('./test-history-userdata');
    const filesPath = path.resolve('./test-history-files');
    
    // Clean start
    if (fs.existsSync(userDataPath)) fs.rmSync(userDataPath, { recursive: true, force: true });
    if (fs.existsSync(filesPath)) fs.rmSync(filesPath, { recursive: true, force: true });
    
    if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
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
    fs.rmSync(userDataPath, { recursive: true, force: true });
    fs.rmSync(filesPath, { recursive: true, force: true });
});
