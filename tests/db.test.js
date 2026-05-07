import assert from 'node:assert';
import { test } from 'node:test';
import path from 'path';
import fs from 'fs';
import FileDatabase from '../src/db.js';

test('FileDatabase should parse filenames correctly', (t) => {
    // We need to create the test-userdata directory
    const userDataPath = path.resolve('./test-userdata');
    const filesPath = path.resolve('./test-files');
    if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
    if (!fs.existsSync(filesPath)) fs.mkdirSync(filesPath, { recursive: true });
    
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
