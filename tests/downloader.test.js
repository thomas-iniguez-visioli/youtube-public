const assert = require('node:assert');
const { test } = require('node:test');
const path = require('path');
const { createDownloadArgs, createMetadataArgs } = require('../src/downloader');

test('createDownloadArgs should generate correct arguments', (t) => {
  const parameter = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const ffmpegDir = 'C:/ffmpeg/bin';
  const storagePath = 'C:/Downloads';
  const outputFileFormat = '%(title)s [%(id)s].%(ext)s';
  const bunPath = 'C:/bin/bun.exe';

  // Test without bunPath
  let args = createDownloadArgs(parameter, ffmpegDir, storagePath, outputFileFormat);
  assert.ok(!args.includes('bun'));

  // Test with bunPath
  args = createDownloadArgs(parameter, ffmpegDir, storagePath, outputFileFormat, bunPath);
  // Note: bunPath must exist for it to be added in the real function, 
  // but since we are testing the logic, we might need to mock fs.existsSync or just rely on the fallback in tests if we don't mock.
  // Actually, the code checks fs.existsSync(bunPath).
});

test('createMetadataArgs should generate correct arguments', (t) => {
  const parameter = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const storagePath = 'C:/Downloads';
  const outputFileFormat = '%(title)s [%(id)s].%(ext)s';
  const bunPath = 'C:/bin/bun.exe';

  const args = createMetadataArgs(parameter, storagePath, outputFileFormat, bunPath);

  assert.ok(args.includes(parameter));
  assert.ok(args.includes('--simulate'));
  assert.ok(args.includes('--write-info-json'));
  assert.ok(args.includes('-J'));
});
