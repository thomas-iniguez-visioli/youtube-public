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
    if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
    if (!fs.existsSync(filesPath)) fs.mkdirSync(filesPath, { recursive: true });
    
    const db = new FileDatabase(filesPath);
    
    // Add dummy file to database
    db.database.push({
        fileName: "test [abc].mp4",
        fileUuid: "uuid-abc",
        yid: "abc",
        tags: []
    });
    db.database.push({
        fileName: "test [def].mp4",
        fileUuid: "uuid-def",
        yid: "def",
        tags: []
    });
    
    db.addToHistory("abc");
    assert.deepStrictEqual(db.history, ["abc"]);
    
    db.addToHistory("def");
    assert.deepStrictEqual(db.history, ["def", "abc"]);
    
    db.addToHistory("abc"); // Move to front
    assert.deepStrictEqual(db.history, ["abc", "def"]);
    
    const historyItems = db.getHistory();
    assert.strictEqual(historyItems.length, 2);
    assert.strictEqual(historyItems[0].yid, "abc");
    assert.strictEqual(historyItems[1].yid, "def");
    
    // Clean up
    fs.rmSync(userDataPath, { recursive: true, force: true });
    fs.rmSync(filesPath, { recursive: true, force: true });
});
