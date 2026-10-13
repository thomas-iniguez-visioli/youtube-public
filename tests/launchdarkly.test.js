import assert from 'node:assert';
import { test } from 'node:test';
import { initLaunchDarkly, getLDClient, getFeatureFlag, getAllFeatureFlags, isLaunchDarklyReady, reloadFlags, disableLaunchDarkly, isLaunchDarklyEnabled, getLaunchDarklyStatus } from '../src/launchdarkly.js';

test('LaunchDarkly module should handle missing config or invalid clientSideId gracefully', async (t) => {
  // With no config or empty clientSideId, client is null and functions return safe defaults
  const client = await initLaunchDarkly();
  assert.strictEqual(client, null);
  
  const flag = getFeatureFlag('test-flag', true);
  assert.strictEqual(flag, true);

  const allFlags = getAllFeatureFlags();
  assert.deepStrictEqual(allFlags, {});
  
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
  assert.deepStrictEqual(getAllFeatureFlags(), {});
});
