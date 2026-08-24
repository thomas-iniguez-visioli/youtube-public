import { describe, it, beforeAll, afterAll } from 'bun:test';
import { expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import FileDatabase from '../src/db.js';

const tempDir = path.join(process.cwd(), 'temp_cleanup_test_dir');

describe('Cleanup System', () => {
    beforeAll(() => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    afterAll(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    it('should correctly delete videos not viewed for a long time and preserve recent ones', async () => {
        const db = new FileDatabase(tempDir);
        db.database = [];
        db.history = [];
        db.playlists = [];
        db.queue = [];
        db.favorites = [];
        db.yidMap.clear();
        
        // Créer des fichiers mp4 et info.json fictifs pour 3 vidéos :
        // 1. Vidéo récente (lastViewedAt = maintenant)
        // 2. Vidéo ancienne vue il y a 40 jours (seuil à 30 jours)
        // 3. Vidéo jamais vue mais ajoutée il y a 45 jours
        
        const video1Id = 'recent11111';
        const video2Id = 'oldviewed22';
        const video3Id = 'neverviewed';
        
        const now = Date.now();
        const thirtyDaysAgo = now - (35 * 24 * 60 * 60 * 1000);
        const fortyFiveDaysAgo = now - (45 * 24 * 60 * 60 * 1000);
        
        // 1. Récente
        fs.writeFileSync(path.join(tempDir, `Video Recent [${video1Id}].mp4`), 'fake video data');
        fs.writeFileSync(path.join(tempDir, `Video Recent [${video1Id}].info.json`), JSON.stringify({ display_id: video1Id, title: 'Recent' }));
        
        // 2. Ancienne vue
        fs.writeFileSync(path.join(tempDir, `Video Old [${video2Id}].mp4`), 'fake video data');
        fs.writeFileSync(path.join(tempDir, `Video Old [${video2Id}].info.json`), JSON.stringify({ display_id: video2Id, title: 'Old viewed' }));
        
        // 3. Jamais vue ancienne
        fs.writeFileSync(path.join(tempDir, `Video Never [${video3Id}].mp4`), 'fake video data');
        fs.writeFileSync(path.join(tempDir, `Video Never [${video3Id}].info.json`), JSON.stringify({ display_id: video3Id, title: 'Never viewed' }));

        // Ajuster les dates mtime de la 3ème vidéo
        fs.utimesSync(path.join(tempDir, `Video Never [${video3Id}].mp4`), new Date(fortyFiveDaysAgo), new Date(fortyFiveDaysAgo));

        // Charger dans la base de données
        await db.readDatabaseAsync();
        
        // Configurer les lastViewedAt
        const entry1 = db.getFile(video1Id);
        if (entry1) entry1.lastViewedAt = now;
        
        const entry2 = db.getFile(video2Id);
        if (entry2) entry2.lastViewedAt = thirtyDaysAgo;
        
        // La vidéo 3 n'a pas de lastViewedAt (jamais vue)
        
        db.saveDatabase();
        
        // Exécuter le nettoyage avec un seuil de 30 jours
        const deletedCount = db.cleanupOldVideos(30);
        
        // On s'attend à ce que 2 vidéos (la 2 et la 3) soient supprimées
        expect(deletedCount).toBe(2);
        
        // Vérifier que la vidéo 1 existe toujours sur le disque et en DB
        expect(db.getFile(video1Id)).toBeDefined();
        expect(fs.existsSync(path.join(tempDir, `Video Recent [${video1Id}].mp4`))).toBe(true);
        
        // Vérifier que les vidéos 2 et 3 sont supprimées sur le disque et en DB
        expect(db.getFile(video2Id)).toBeFalsy();
        expect(fs.existsSync(path.join(tempDir, `Video Old [${video2Id}].mp4`))).toBe(false);
        expect(fs.existsSync(path.join(tempDir, `Video Old [${video2Id}].info.json`))).toBe(false);
        
        expect(db.getFile(video3Id)).toBeFalsy();
        expect(fs.existsSync(path.join(tempDir, `Video Never [${video3Id}].mp4`))).toBe(false);
    });
});
