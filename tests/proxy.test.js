import assert from 'node:assert';
import { test } from 'node:test';
import { getProxyFor, getHttpsAgent, ytProxyArgs, ytProxyEnv, getChromiumProxyConfig } from '../src/proxy.js';
import { createDownloadArgs, createMetadataArgs } from '../src/downloader.js';

// Un seul test séquentiel : bun test exécute les tests en parallèle, un
// clear/restore global de process.env serait racy entre les cas.
// Sous Windows/bun, `delete process.env.X` ne masque pas les vars héritées du
// parent (lecture qui retombe sur l'OS) : on force '' (falsy pour proxy-from-env).
test('proxy env: résolution, args yt-dlp, agent https et config Chromium', (t) => {
  const PROXY_VARS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'];
  const saved = {};
  function blankProxyEnv() {
    for (const key of PROXY_VARS) {
      if (!(key in saved)) saved[key] = process.env[key];
      process.env[key] = '';
    }
  }
  blankProxyEnv();
  t.after(() => {
    for (const key of PROXY_VARS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  // 1. Aucune variable : pas de proxy du tout
  assert.strictEqual(getProxyFor('https://www.youtube.com/'), null);
  assert.strictEqual(getHttpsAgent('https://www.youtube.com/'), undefined);
  assert.deepStrictEqual(ytProxyArgs(), []);
  assert.strictEqual(getChromiumProxyConfig(), null);
  assert.ok(!('HTTPS_PROXY' in ytProxyEnv()) || !ytProxyEnv().HTTPS_PROXY, 'pas d HTTPS_PROXY injecté sans config');
  assert.ok(!createMetadataArgs('https://www.youtube.com/watch?v=dQw4w9WgXcQ', null, 'C:/Dl', '%(title)s').includes('--proxy'));

  // 2. HTTPS_PROXY : tout est configuré
  process.env.HTTPS_PROXY = 'http://127.0.0.1:8080';
  process.env.https_proxy = 'http://127.0.0.1:8080';
  assert.strictEqual(getProxyFor('https://www.youtube.com/'), 'http://127.0.0.1:8080');
  assert.deepStrictEqual(ytProxyArgs(), ['--proxy', 'http://127.0.0.1:8080']);
  assert.ok(getHttpsAgent('https://www.youtube.com/'), 'agent https créé');
  assert.strictEqual(ytProxyEnv().HTTPS_PROXY, 'http://127.0.0.1:8080', 'HTTPS_PROXY injecté pour yt-dlp');

  const cfg = getChromiumProxyConfig();
  assert.ok(cfg, 'config Chromium créée');
  assert.strictEqual(cfg.mode, 'fixed_servers');
  assert.strictEqual(cfg.proxyRules, 'http://127.0.0.1:8080');
  assert.ok(cfg.proxyBypassRules.includes('localhost'));
  assert.ok(cfg.proxyBypassRules.includes('127.0.0.1'));

  const args = createDownloadArgs('https://www.youtube.com/watch?v=dQw4w9WgXcQ', null, 'C:/Dl', '%(title)s');
  const idx = args.indexOf('--proxy');
  assert.ok(idx !== -1, '--proxy présent dans createDownloadArgs');
  assert.strictEqual(args[idx + 1], 'http://127.0.0.1:8080');

  // 3. NO_PROXY : localhost exempté, youtube toujours proxifié
  process.env.NO_PROXY = 'localhost,127.0.0.1,*.internal';
  assert.strictEqual(getProxyFor('http://localhost:8001/'), null);
  assert.strictEqual(getHttpsAgent('http://localhost:8001/'), undefined);
  assert.strictEqual(getProxyFor('https://www.youtube.com/'), 'http://127.0.0.1:8080');

  // 4. NO_PROXY=* : tout désactivé
  process.env.NO_PROXY = '*';
  process.env.no_proxy = '*';
  assert.strictEqual(getProxyFor('https://www.youtube.com/'), null);
  assert.deepStrictEqual(ytProxyArgs(), []);
  assert.strictEqual(getChromiumProxyConfig(), null);

  // 5. HTTP_PROXY seul : ne s'applique pas à https (comportement standard)
  blankProxyEnv();
  process.env.HTTP_PROXY = 'http://127.0.0.1:8080';
  process.env.http_proxy = 'http://127.0.0.1:8080';
  assert.strictEqual(getProxyFor('https://www.youtube.com/'), null);
  assert.strictEqual(getProxyFor('http://example.com/'), 'http://127.0.0.1:8080');
});
