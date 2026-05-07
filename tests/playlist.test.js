import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from "fs";
import path from "path";
import os from "os";
import FileDatabase from "../src/db.js";

describe("Playlist System", () => {
    let db;
    const tempDir = path.join(os.tmpdir(), "youtube-test-playlists");
    // Since we can't mock electron easily, db.js will use process.cwd() for database.json
    const dbPath = path.join(process.cwd(), 'database.json');

    before(() => {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        db = new FileDatabase(tempDir);
        // Mock some videos
        db.database = [
            { fileName: "vid1 [id1].mp4", yid: "id1", tags: [] },
            { fileName: "vid2 [id2].mp4", yid: "id2", tags: [] }
        ];
        db._buildIndex();
    });

    after(() => {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    });

    test("should create a playlist", () => {
        const result = db.createPlaylist("Ma Liste");
        assert.strictEqual(result, true);
        assert.strictEqual(db.playlists.length, 1);
        assert.strictEqual(db.playlists[0].name, "Ma Liste");
    });

    test("should not create duplicate playlist", () => {
        const result = db.createPlaylist("Ma Liste");
        assert.strictEqual(result, false);
        assert.strictEqual(db.playlists.length, 1);
    });

    test("should add video to playlist", () => {
        const result = db.addVideoToPlaylist("Ma Liste", "id1");
        assert.strictEqual(result, true);
        assert.ok(db.playlists[0].videoIds.includes("id1"));
    });

    test("should remove video from playlist", () => {
        db.removeVideoFromPlaylist("Ma Liste", "id1");
        assert.ok(!db.playlists[0].videoIds.includes("id1"));
    });

    test("should delete playlist", () => {
        db.deletePlaylist("Ma Liste");
        assert.strictEqual(db.playlists.length, 0);
    });
});
