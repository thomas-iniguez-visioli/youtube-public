import assert from 'node:assert';
import { test } from 'node:test';
import FileDatabase from '../src/db.js';
import { trackEvent, getExperimentVariation, getOrCreateUserId, getUserContext } from '../src/launchdarkly.js';

test('LaunchDarkly A/B experimentation tracking and variations', async () => {
    // 1. Persistent anonymous user identity for A/B bucketing
    const userId = await getOrCreateUserId();
    assert.ok(typeof userId === 'string' && userId.length > 5, 'User ID should be non-empty string');

    const context = await getUserContext();
    assert.strictEqual(context.key, userId);
    assert.strictEqual(context.anonymous, true);

    // 2. Variations evaluation
    const variant = getExperimentVariation('ab-tubearchivist-ui', 'archive');
    assert.ok(['control', 'archive', 'treatment'].includes(variant) || variant === 'archive');

    // 3. Metric and conversion tracking
    const result1 = trackEvent('video_view', { id: 'testVid1' }, 120);
    assert.strictEqual(typeof result1, 'boolean');

    const result2 = trackEvent('conversion_click', { button: 'download' });
    assert.strictEqual(typeof result2, 'boolean');

    // 4. Invalid event validation
    assert.strictEqual(trackEvent(''), false);
    assert.strictEqual(trackEvent(null), false);
    assert.strictEqual(trackEvent(undefined), false);
});

test('TubeArchivist Watch State, Progress and Archive Statistics', () => {
    const db = new FileDatabase('./test-tubearchivist-dir');
    db.database = [
        { yid: 'vid1', fileName: 'Alpha [vid1].mp4', uploader: 'CreatorA', duration: 300, view_count: 1000, size: 5000000 },
        { yid: 'vid2', fileName: 'Beta [vid2].mp4', uploader: 'CreatorB', duration: 600, view_count: 500, size: 10000000 },
        { yid: 'vid3', fileName: 'Gamma [vid3].mp4', uploader: 'CreatorA', duration: 120, view_count: 200, size: 2000000 }
    ];
    db._buildIndex();

    // 1. Initial status
    assert.strictEqual(db.isWatched('vid1'), false);
    assert.strictEqual(db.getWatchProgress('vid1').percentage, 0);

    // 2. In-progress watching (< 90%)
    const p1 = db.setWatchProgress('vid1', 120, 300); // 40%
    assert.strictEqual(p1.percentage, 40);
    assert.strictEqual(p1.watched, false);
    assert.strictEqual(db.isWatched('vid1'), false);

    // 3. Completed watching (>= 90%)
    const p2 = db.setWatchProgress('vid2', 550, 600); // ~92%
    assert.strictEqual(p2.percentage, 92);
    assert.strictEqual(p2.watched, true);
    assert.strictEqual(db.isWatched('vid2'), true);

    // 4. Toggle watched state
    assert.strictEqual(db.toggleWatched('vid3'), true);
    assert.strictEqual(db.isWatched('vid3'), true);
    assert.strictEqual(db.getWatchProgress('vid3').percentage, 100);

    assert.strictEqual(db.toggleWatched('vid3'), false);
    assert.strictEqual(db.isWatched('vid3'), false);
    assert.strictEqual(db.getWatchProgress('vid3').percentage, 0);

    // 5. Filter lists
    const watchedList = db.getWatchedVideos();
    assert.strictEqual(watchedList.length, 1);
    assert.strictEqual(watchedList[0].yid, 'vid2');

    const unwatchedList = db.getUnwatchedVideos();
    assert.strictEqual(unwatchedList.length, 2);

    // 6. Archive Statistics
    const stats = db.getArchiveStats();
    assert.strictEqual(stats.totalVideos, 3);
    assert.strictEqual(stats.watchedCount, 1);
    assert.strictEqual(stats.unwatchedCount, 2);
    assert.strictEqual(stats.inProgressCount, 1); // vid1 is 40%
    assert.strictEqual(stats.watchedPercentage, 33);
    assert.strictEqual(stats.totalDurationSeconds, 1020);
    assert.strictEqual(stats.totalChannels, 2);
    assert.strictEqual(stats.totalSizeBytes, 17000000);
});
