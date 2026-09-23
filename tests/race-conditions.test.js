import assert from 'node:assert';
import { test } from 'node:test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { runDownload, gzipFile, gunzipFile } from '../src/downloader.js';

const fakeYtdlp = fileURLToPath(new URL('./fixtures/fake-ytdlp.js', import.meta.url));

const waitUntil = async (cond, timeoutMs = 5000) => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitUntil: condition non atteinte dans le délai imparti');
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

test('runDownload n\'émet onVideoFinished qu\'après la fin du process (code 0)', async () => {
  const finishedFiles = [];
  const events = [];
  let sawProgress = false;

  const promise = runDownload(
    process.execPath,
    [fakeYtdlp],
    null,
    (file) => {
      finishedFiles.push(file);
      events.push('finished');
    },
    () => {
      sawProgress = true;
    },
    null
  ).then(() => {
    events.push('resolved');
  });

  // Attendre que stdout soit traité (la ligne Destination précède la ligne 100%)
  await waitUntil(() => sawProgress);
  // Le processus est encore vivant : aucune émission anticipée ne doit avoir eu lieu
  assert.strictEqual(finishedFiles.length, 0, 'onVideoFinished ne doit pas être émis tant que le process tourne');

  await promise;

  assert.strictEqual(finishedFiles.length, 1);
  assert.ok(finishedFiles[0].includes('Video [dQw4w9WgXcQ].mp4'), `fichier inattendu: ${finishedFiles[0]}`);
  // L'émission doit précéder la résolution de la promesse
  assert.deepStrictEqual(events, ['finished', 'resolved']);
});

test('runDownload n\'émet pas onVideoFinished si le process échoue', async () => {
  const finishedFiles = [];
  let sawProgress = false;

  const promise = runDownload(
    process.execPath,
    [fakeYtdlp, 'fail'],
    null,
    (file) => finishedFiles.push(file),
    () => {
      sawProgress = true;
    },
    null
  );

  await waitUntil(() => sawProgress);
  await assert.rejects(promise, /code 1/);

  // Une fois rejeté, aucune émission tardive ne doit survenir
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.strictEqual(finishedFiles.length, 0, 'aucune émission attendue sur un échec');
});

test('gzipFile crée le zip, supprime la source et ne laisse pas de .tmp', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gzip-test-'));
  try {
    const src = path.join(dir, 'Video [abcdefghijk].mp4');
    const payload = Buffer.alloc(64 * 1024, 7);
    fs.writeFileSync(src, payload);

    await gzipFile(src, null);

    const zipPath = src + '.zip';
    assert.ok(fs.existsSync(zipPath), 'le zip doit exister');
    assert.ok(!fs.existsSync(zipPath + '.tmp'), 'aucun .tmp ne doit rester');
    assert.ok(!fs.existsSync(src), 'la source doit être supprimée');

    // Roundtrip : le zip doit être lisible et restaurer l'intégralité des octets
    const restored = path.join(dir, 'restored.mp4');
    await gunzipFile(zipPath, restored, null);
    assert.ok(fs.existsSync(restored));
    assert.strictEqual(fs.readFileSync(restored).length, payload.length);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('gzipFile rejette sur fichier absent sans laisser de .tmp', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gzip-test-'));
  try {
    const src = path.join(dir, 'does-not-exist.mp4');
    await assert.rejects(gzipFile(src, null));
    assert.ok(!fs.existsSync(src + '.zip'), 'aucun zip ne doit être créé');
    assert.ok(!fs.existsSync(src + '.zip.tmp'), 'aucun .tmp ne doit rester');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
