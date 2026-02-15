const assert = require('node:assert');
const { test, mock } = require('node:test');
const path = require('path');
const fs = require('fs');

// Mock electron app before requiring db.js
const mockApp = {
    getPath: (name) => {
        if (name === 'userData') return './test-userdata';
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

test('FileDatabase should parse filenames correctly', (t) => {
    // Note: the getid function in db.js seems to have some issues based on its code
    // Let's see how it behaves.
    
    // We need to create the test-userdata directory
    const userDataPath = path.resolve('./test-userdata');
    const filesPath = path.resolve('./test-files');
    if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath);
    if (!fs.existsSync(filesPath)) fs.mkdirSync(filesPath);
    
    const db = new FileDatabase(filesPath);
    
    // Test filename with [id]
    const testFileName = "Channel-Folder-Title [videoId].mp4";
    const infoFileName = "Channel-Folder-Title [videoId].info.json";
    
    fs.writeFileSync(path.join(filesPath, testFileName), "fake video content");
    fs.writeFileSync(path.join(filesPath, infoFileName), JSON.stringify({
        display_id: "videoId",
        uploader: "Channel"
    }));
    
    db.readDatabase();
    
    const file = db.getFile("videoId");
    assert.ok(file, "File should be found by videoId");
    assert.strictEqual(file.fileName, testFileName);
    
    // Clean up
    fs.unlinkSync(path.join(filesPath, testFileName));
    fs.unlinkSync(path.join(filesPath, infoFileName));
    fs.rmSync(userDataPath, { recursive: true, force: true });
    fs.rmSync(filesPath, { recursive: true, force: true });
});
