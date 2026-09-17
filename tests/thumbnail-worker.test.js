import assert from 'node:assert';
import { test } from 'node:test';
import { indexChannelVideos } from '../src/thumbnail-worker.js';

test('thumbnail worker indexes the first usable video for each channel', () => {
    const firstVideo = { uploader: 'Channel A', channel_url: 'https://example.com/a' };
    const secondVideo = { uploader: 'Channel A', channel_url: 'https://example.com/a-2' };
    const withoutChannelUrl = { uploader: 'Channel B' };

    const indexed = indexChannelVideos([firstVideo, secondVideo, withoutChannelUrl]);

    assert.strictEqual(indexed.get('Channel A'), firstVideo);
    assert.strictEqual(indexed.has('Channel B'), false);
});
