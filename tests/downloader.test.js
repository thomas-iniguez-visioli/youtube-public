const assert = require('node:assert');
const { test } = require('node:test');
const path = require('path');
const { createDownloadArgs, createMetadataArgs } = require('../src/downloader');

test('createDownloadArgs should generate correct arguments', (t) => {
  const parameter = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const ffmpegDir = 'C:/ffmpeg/bin';
  const storagePath = 'C:/Downloads';
  const outputFileFormat = '%(title)s [%(id)s].%(ext)s';
  const denoPath = 'C:/bin/deno.exe';

  // Test without denoPath
  let args = createDownloadArgs(parameter, ffmpegDir, storagePath, outputFileFormat);
  assert.ok(!args.includes('deno'));

  // Test with denoPath (logic in src/downloader.js adds --js-runtimes deno if denoPath exists)
});

test('createMetadataArgs should generate correct arguments', (t) => {
  const parameter = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const storagePath = 'C:/Downloads';
  const outputFileFormat = '%(title)s [%(id)s].%(ext)s';
  const denoPath = 'C:/bin/deno.exe';

  const args = createMetadataArgs(parameter, storagePath, outputFileFormat, denoPath);

  assert.ok(args.includes(parameter));
  assert.ok(args.includes('--simulate'));
  assert.ok(args.includes('--write-info-json'));
  assert.ok(args.includes('-J'));
});
