import assert from 'node:assert';
import { test } from 'node:test';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDownloadArgs, createMetadataArgs, fetchSuggestions, compressVideo } from '../src/downloader.js';

// Fichier existant servant de chemin de runtime (qjs) pour les assertions
const qjsPath = fileURLToPath(import.meta.url);

test('createDownloadArgs should generate correct arguments', (t) => {
  const parameter = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const ffmpegDir = 'C:/ffmpeg/bin';
  const storagePath = 'C:/Downloads';
  const outputFileFormat = '%(title)s [%(id)s].%(ext)s';

  // Test without qjsPath
  let args = createDownloadArgs(parameter, ffmpegDir, storagePath, outputFileFormat);
  assert.ok(!args.includes('--js-runtimes'));
  assert.ok(!args.includes('--no-js-runtimes'));
  assert.strictEqual(args[args.length - 2], '--');
  assert.strictEqual(args[args.length - 1], parameter);

  // Test with qjsPath : deno (runtime par défaut) doit être désactivé AVANT quickjs
  args = createDownloadArgs(parameter, ffmpegDir, storagePath, outputFileFormat, qjsPath);
  const noRuntimeIdx = args.indexOf('--no-js-runtimes');
  const runtimeIdx = args.indexOf('--js-runtimes');
  assert.ok(noRuntimeIdx !== -1, '--no-js-runtimes manquant');
  assert.ok(runtimeIdx !== -1, '--js-runtimes manquant');
  assert.ok(noRuntimeIdx < runtimeIdx, '--no-js-runtimes doit précéder --js-runtimes');
  assert.strictEqual(args[runtimeIdx + 1], `quickjs:${qjsPath}`);
  assert.strictEqual(args[args.length - 2], '--');
  assert.strictEqual(args[args.length - 1], parameter);
});

test('createMetadataArgs should generate correct arguments', (t) => {
  const parameter = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const storagePath = 'C:/Downloads';
  const outputFileFormat = '%(title)s [%(id)s].%(ext)s';

  const args = createMetadataArgs(parameter, null, storagePath, outputFileFormat, qjsPath);

  assert.ok(args.includes(parameter));
  assert.ok(args.includes('--simulate'));
  assert.ok(args.includes('--write-info-json'));
  assert.ok(args.includes('-J'));
  assert.ok(args.includes('--no-js-runtimes'));
  assert.strictEqual(args[args.indexOf('--js-runtimes') + 1], `quickjs:${qjsPath}`);
  assert.strictEqual(args[args.length - 2], '--');
  assert.strictEqual(args[args.length - 1], parameter);
});

test('fetchSuggestions should reject on invalid ytdlp binary', async (t) => {
  await assert.rejects(
    fetchSuggestions('invalid-ytdlp-path', 'test query'),
    /ENOENT|ytdlp/
  );
});

test('compressVideo should reject on invalid ffmpeg binary', async (t) => {
  await assert.rejects(
    compressVideo('invalid-ffmpeg-path', 'some-input-path.mp4'),
    /Binaire ffmpeg introuvable/
  );
});

test('runDownload should call onProcessCreated and support process termination', async (t) => {
  const { runDownload } = await import('../src/downloader.js');
  const dummyCmd = process.platform === 'win32' ? 'ping' : 'sleep';
  const dummyArgs = process.platform === 'win32' ? ['127.0.0.1', '-n', '5'] : ['5'];
  
  let spawnedProc = null;
  const promise = runDownload(dummyCmd, dummyArgs, null, null, null, (proc) => {
    spawnedProc = proc;
  });
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  assert.ok(spawnedProc !== null, 'Spawned process should be returned via callback');
  assert.ok(spawnedProc.pid > 0, 'Spawned process should have a valid PID');
  
  spawnedProc.kill('SIGKILL');
  
  try {
    await promise;
  } catch (err) {
    assert.ok(err);
  }
});
