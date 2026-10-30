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
    
    let file = db.getFile("videoId");
    assert.ok(file, "File should be found by videoId");
    assert.strictEqual(file.fileName, testFileName);
    
    // Clean up mp4 and write .mp4.zip instead
    fs.unlinkSync(path.join(filesPath, testFileName));
    const testFileNameZip = "Channel-Folder-Title [videoId].mp4.zip";
    fs.writeFileSync(path.join(filesPath, testFileNameZip), "fake zip content");
    
    db.readDatabase();
    
    file = db.getFile("videoId");
    assert.ok(file, "File should still be found by videoId even if stored as .mp4.zip");
    assert.strictEqual(file.fileName, testFileName, "Filename inside DB should still use .mp4 extension");
    
    // Clean up
    fs.unlinkSync(path.join(filesPath, testFileNameZip));
    fs.unlinkSync(path.join(filesPath, infoFileName));
    fs.rmSync(userDataPath, { recursive: true, force: true });
    fs.rmSync(filesPath, { recursive: true, force: true });
});


test('FileDatabase should manage TubeArchivist watch progress and stats', (t) => {
    const filesPath = path.resolve('./test-files-stats');
    if (!fs.existsSync(filesPath)) fs.mkdirSync(filesPath, { recursive: true });
    
    const db = new FileDatabase(filesPath);
    db.database = [
        { yid: 'v1', fileName: 'Video 1 [v1].mp4', uploader: 'ChanA', duration: 100 },
        { yid: 'v2', fileName: 'Video 2 [v2].mp4', uploader: 'ChanB', duration: 200 }
    ];
    db._buildIndex();

    // 1. Initial state
    assert.strictEqual(db.isWatched('v1'), false);
    assert.deepStrictEqual(db.getWatchProgress('v1'), {
        currentTime: 0,
        duration: 0,
        percentage: 0,
        watched: false,
        updatedAt: null
    });

    // 2. Set progress 50%
    const p1 = db.setWatchProgress('v1', 50, 100);
    assert.strictEqual(p1.percentage, 50);
    assert.strictEqual(p1.watched, false);
    assert.strictEqual(db.isWatched('v1'), false);

    // 3. Set progress >= 90% -> auto-watched
    const p2 = db.setWatchProgress('v1', 95, 100);
    assert.strictEqual(p2.percentage, 95);
    assert.strictEqual(p2.watched, true);
    assert.strictEqual(db.isWatched('v1'), true);

    // 4. Manual toggle watched
    const toggled = db.toggleWatched('v2');
    assert.strictEqual(toggled, true);
    assert.strictEqual(db.isWatched('v2'), true);

    const toggledBack = db.toggleWatched('v2');
    assert.strictEqual(toggledBack, false);
    assert.strictEqual(db.isWatched('v2'), false);

    // 5. TubeArchivist Archive Stats
    const stats = db.getArchiveStats();
    assert.strictEqual(stats.totalVideos, 2);
    assert.strictEqual(stats.watchedCount, 1);
    assert.strictEqual(stats.unwatchedCount, 1);
    assert.strictEqual(stats.totalDurationSeconds, 300);
    assert.strictEqual(stats.totalChannels, 2);

    // Clean up
    fs.rmSync(filesPath, { recursive: true, force: true });
});

test('FileDatabase snapshot signatures are compact, stable and change-sensitive', () => {
    const filesPath = path.resolve('./test-files-signatures');
    if (!fs.existsSync(filesPath)) fs.mkdirSync(filesPath, { recursive: true });
    const db = new FileDatabase(filesPath);

    // Signature compacte : quelques octets, pas une copie de la chaîne
    const snapshot = JSON.stringify({ yid: 'v1', data: 'x'.repeat(10000) });
    const sig = db._snapshotSignature(snapshot);
    assert.ok(sig.length < 24, `Signature should stay compact, got: ${sig}`);

    // Stable pour un contenu identique
    assert.strictEqual(db._snapshotSignature(snapshot), sig);

    // Détecte un contenu différent (même longueur ou non)
    assert.notStrictEqual(db._snapshotSignature(JSON.stringify({ yid: 'v1', data: 'y'.repeat(10000) })), sig);
    assert.notStrictEqual(db._snapshotSignature('abc'), db._snapshotSignature('abd'));

    fs.rmSync(filesPath, { recursive: true, force: true });
});
