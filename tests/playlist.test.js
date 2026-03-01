import { expect, test, describe, beforeAll, afterAll } from "bun:test";
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

    beforeAll(() => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        db = new FileDatabase(tempDir);
        // Mock some videos
        db.database = [
            { fileName: "vid1 [id1].mp4", yid: "id1", tags: [] },
            { fileName: "vid2 [id2].mp4", yid: "id2", tags: [] }
        ];
    });

    afterAll(() => {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
    });

    test("should create a playlist", () => {
        const result = db.createPlaylist("Ma Liste");
        expect(result).toBe(true);
        expect(db.playlists.length).toBe(1);
        expect(db.playlists[0].name).toBe("Ma Liste");
    });

    test("should not create duplicate playlist", () => {
        const result = db.createPlaylist("Ma Liste");
        expect(result).toBe(false);
        expect(db.playlists.length).toBe(1);
    });

    test("should add video to playlist", () => {
        const result = db.addVideoToPlaylist("Ma Liste", "id1");
        expect(result).toBe(true);
        expect(db.playlists[0].videoIds).toContain("id1");
    });

    test("should remove video from playlist", () => {
        db.removeVideoFromPlaylist("Ma Liste", "id1");
        expect(db.playlists[0].videoIds).not.toContain("id1");
    });

    test("should delete playlist", () => {
        db.deletePlaylist("Ma Liste");
        expect(db.playlists.length).toBe(0);
    });
});
