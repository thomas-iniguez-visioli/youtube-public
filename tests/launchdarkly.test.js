import assert from 'node:assert';
import { test } from 'node:test';
import { initLaunchDarkly, getLDClient, getFeatureFlag, getAllFeatureFlags, isLaunchDarklyReady, reloadFlags, disableLaunchDarkly, isLaunchDarklyEnabled, getLaunchDarklyStatus, FROZEN_FLAGS_100 } from '../src/launchdarkly.js';

test('LaunchDarkly module should handle missing config or invalid clientSideId gracefully', async (t) => {
  // With no config or empty clientSideId, client is null and functions return safe defaults
  const client = await initLaunchDarkly();
  assert.strictEqual(client, null);
  
  const flag = getFeatureFlag('test-flag', true);
  assert.strictEqual(flag, true);

  const allFlags = getAllFeatureFlags();
  assert.deepStrictEqual(allFlags, { ...FROZEN_FLAGS_100 });
  
  // New feature: isLaunchDarklyReady should return false when disabled
  assert.strictEqual(isLaunchDarklyReady(), false);
});

test('getFeatureFlag should return default value for invalid keys', async (t) => {
  await initLaunchDarkly();
  
  // Invalid key types should return default
  assert.strictEqual(getFeatureFlag('', false), false);
  assert.strictEqual(getFeatureFlag(null, true), true);
  assert.strictEqual(getFeatureFlag(undefined, false), false);
  assert.strictEqual(getFeatureFlag(123, true), true); // number key
  
  // Valid key with default
  assert.strictEqual(getFeatureFlag('valid-flag', false), false);
  assert.strictEqual(getFeatureFlag('another-flag', 'default'), 'default');
});

test('LaunchDarkly should expose a disabled status when unavailable', async () => {
  await initLaunchDarkly();

  assert.strictEqual(isLaunchDarklyEnabled(), false);
  assert.strictEqual(isLaunchDarklyReady(), false);

  const status = getLaunchDarklyStatus();
  assert.strictEqual(status.enabled, false);
  assert.strictEqual(status.ready, false);
  assert.ok(status.reason, 'une raison de désactivation doit être exposée');
});

test('disableLaunchDarkly should be idempotent and keep degraded mode safe', async () => {
  await initLaunchDarkly();
  const reasonBefore = getLaunchDarklyStatus().reason;

  // Désactivation explicite : la première raison (indisponibilité) est conservée
  disableLaunchDarkly('désactivation manuelle de test');
  assert.strictEqual(getLaunchDarklyStatus().reason, reasonBefore);

  assert.strictEqual(await initLaunchDarkly(), null);
  assert.strictEqual(getLDClient(), null);
  assert.strictEqual(isLaunchDarklyReady(), false);

  // Aucune exception en mode dégradé
  await reloadFlags();
  assert.strictEqual(getFeatureFlag('flag-hors-ligne', 'fallback'), 'fallback');
  assert.deepStrictEqual(getAllFeatureFlags(), { ...FROZEN_FLAGS_100 });
});

test('les flags historiques LaunchDarkly sont gelés à 100% sans passer par LaunchDarkly', async () => {
  const client = await initLaunchDarkly();
  assert.strictEqual(client, null);
  assert.strictEqual(getLDClient(), null);
  assert.strictEqual(isLaunchDarklyEnabled(), false);

  for (const key of Object.keys(FROZEN_FLAGS_100)) {
    assert.strictEqual(getFeatureFlag(key, false), true, `${key} doit être servi à 100% (true)`);
  }

  const all = getAllFeatureFlags();
  for (const [key, value] of Object.entries(FROZEN_FLAGS_100)) {
    assert.strictEqual(all[key], value, `${key} doit apparaître à true dans getAllFeatureFlags()`);
  }
});
