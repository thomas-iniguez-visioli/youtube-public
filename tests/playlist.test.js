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

    test("should automatically ensure a YouTube playlist when read", () => {
        db.ensureYoutubePlaylist("id2", "Mes Chansons Préférées");
        const playlist = db.getPlaylist("Playlist: Mes Chansons Préférées");
        assert.ok(playlist, "Playlist should be created");
        assert.ok(playlist.videoIds.includes("id2"), "Video should be added to the playlist");
    });

    test("should scan and import playlist info.json files during readDatabase", () => {
        const playlistInfoPath = path.join(tempDir, "CCRVEVO--CCRVEVO - Videos [playlist_id].info.json");
        const playlistData = {
            _type: "playlist",
            title: "CCRVEVO - Videos",
            entries: [
                { id: "id1" },
                { id: "id2" }
            ]
        };
        fs.writeFileSync(playlistInfoPath, JSON.stringify(playlistData));

        db.readDatabase();
        
        const playlist = db.getPlaylist("Playlist: CCRVEVO - Videos");
        assert.ok(playlist, "Playlist should be detected and created");
        assert.ok(playlist.videoIds.includes("id1"), "id1 should be in the playlist");
        assert.ok(playlist.videoIds.includes("id2"), "id2 should be in the playlist");

        fs.unlinkSync(playlistInfoPath);
    });

    test("should scan and import playlist info.json files during readDatabaseAsync", async () => {
        const playlistInfoPath = path.join(tempDir, "CCRVEVO--CCRVEVO - AsyncVideos [playlist_id2].info.json");
        const playlistData = {
            _type: "playlist",
            title: "CCRVEVO - AsyncVideos",
            entries: [
                { id: "id1" },
                { id: "id2" }
            ]
        };
        fs.writeFileSync(playlistInfoPath, JSON.stringify(playlistData));

        await db.readDatabaseAsync();
        
        const playlist = db.getPlaylist("Playlist: CCRVEVO - AsyncVideos");
        assert.ok(playlist, "Playlist should be detected and created asynchronously");
        assert.ok(playlist.videoIds.includes("id1"), "id1 should be in the playlist");
        assert.ok(playlist.videoIds.includes("id2"), "id2 should be in the playlist");

        fs.unlinkSync(playlistInfoPath);
    });
});
