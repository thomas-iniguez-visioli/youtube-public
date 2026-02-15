const assert = require('node:assert');
const { test } = require('node:test');
const path = require('path');
const { createDownloadArgs, createMetadataArgs } = require('../src/downloader');

test('createDownloadArgs should generate correct arguments', (t) => {
  const parameter = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const ffmpegDir = 'C:/ffmpeg/bin';
  const storagePath = 'C:/Downloads';
  const outputFileFormat = '%(title)s [%(id)s].%(ext)s';

  const args = createDownloadArgs(parameter, ffmpegDir, storagePath, outputFileFormat);

  assert.ok(args.includes(parameter));
  assert.ok(args.includes(ffmpegDir));
  assert.ok(args.includes('--ffmpeg-location'));
  assert.ok(args.includes('--remux'));
  assert.ok(args.includes('mp4'));
  
  const expectedPath = path.join(storagePath, outputFileFormat);
  assert.ok(args.includes(expectedPath));
});

test('createMetadataArgs should generate correct arguments', (t) => {
  const parameter = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const storagePath = 'C:/Downloads';
  const outputFileFormat = '%(title)s [%(id)s].%(ext)s';

  const args = createMetadataArgs(parameter, storagePath, outputFileFormat);

  assert.ok(args.includes(parameter));
  assert.ok(args.includes('--simulate'));
  assert.ok(args.includes('--write-info-json'));
  assert.ok(args.includes('-J'));
  
  const expectedPath = path.join(storagePath, outputFileFormat);
  assert.ok(args.includes(expectedPath));
});
