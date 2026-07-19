import assert from 'node:assert';
import { test } from 'node:test';
import path from 'path';
import fs from 'fs';
import FileDatabase from '../src/db.js';
import { gzipFile, gunzipFile } from '../src/downloader.js';

test('Edge cases - FileDatabase with empty or invalid states', (t) => {
    const filesPath = path.resolve('./test-files-edge');
    if (!fs.existsSync(filesPath)) fs.mkdirSync(filesPath, { recursive: true });

    const db = new FileDatabase(filesPath);
    db.readDatabase();

    // Edge case 1: Database is empty
    assert.strictEqual(db.database.length, 0);
    assert.strictEqual(db.getFile("nonexistent_id"), null);

    // Edge case 2: File with invalid extension should be ignored
    fs.writeFileSync(path.join(filesPath, "test [invalid].txt"), "some content");
    db.readDatabase();
    assert.strictEqual(db.database.length, 0);

    // Clean up
    fs.unlinkSync(path.join(filesPath, "test [invalid].txt"));
    fs.rmSync(filesPath, { recursive: true, force: true });
});

test('Edge cases - adm-zip wrapper errors', async (t) => {
    const tempDir = path.resolve('./test-zip-edge');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Edge case 1: compress non-existent file
    const fakeFilePath = path.join(tempDir, 'missing.mp4');
    await assert.rejects(
        gzipFile(fakeFilePath),
        /not found|invalid/i,
        "Should throw error when compressing non-existent file"
    );

    // Edge case 2: decompress non-existent archive
    const fakeZipPath = path.join(tempDir, 'missing.zip');
    await assert.rejects(
        gunzipFile(fakeZipPath, path.join(tempDir, 'out.mp4')),
        /not found|invalid/i,
        "Should throw error when decompressing non-existent archive"
    );

    // Edge case 3: empty file compression and decompression
    const emptyFilePath = path.join(tempDir, 'empty.mp4');
    fs.writeFileSync(emptyFilePath, '');
    const zipPath = emptyFilePath + '.zip';
    const outPath = path.join(tempDir, 'empty_out.mp4');

    await gzipFile(emptyFilePath);
    assert.ok(fs.existsSync(zipPath), "Empty zip archive should be created");

    await gunzipFile(zipPath, outPath);
    assert.ok(fs.existsSync(outPath), "Empty file should be unpacked");
    assert.strictEqual(fs.readFileSync(outPath).length, 0, "Unpacked file should be empty");

    // Clean up
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    fs.rmSync(tempDir, { recursive: true, force: true });
});
