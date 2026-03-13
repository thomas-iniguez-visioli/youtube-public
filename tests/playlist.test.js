const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require("fs");
const path = require("path");
const os = require("os");

// Mock electron app before requiring db.js
const mockApp = {
    getPath: (name) => {
        if (name === 'userData') return os.tmpdir();
        return os.tmpdir();
    }
};

require.cache[require.resolve('electron')] = {
    cache: {},
    exports: {
        app: mockApp
    }
};

const FileDatabase = require("../src/db");

describe("Playlist System", () => {
    let db;
    const tempDir = path.join(os.tmpdir(), "youtube-test-playlists");

    before(() => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        db = new FileDatabase(tempDir);
        // Mock some videos
        db.database = [
            { fileName: "vid1 [id1].mp4", yid: "id1", tags: [] },
            { fileName: "vid2 [id2].mp4", yid: "id2", tags: [] }
        ];
    });

    after(() => {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
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
