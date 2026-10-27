import assert from 'node:assert';
import { test } from 'node:test';
import { initLaunchDarkly, getLDClient, getFeatureFlag, getAllFeatureFlags, isLaunchDarklyReady, reloadFlags, disableLaunchDarkly, isLaunchDarklyEnabled, getLaunchDarklyStatus, trackEvent, getExperimentVariation, getOrCreateUserId, getUserContext, getRolloutBucket, isFeatureInRollout, getRolloutStatus, calculateDailyRolloutPercentage, getReleaseDate } from '../src/launchdarkly.js';

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


test('LaunchDarkly A/B testing helpers provide persistent user context and metric tracking', async () => {
  const userId1 = await getOrCreateUserId();
  assert.ok(typeof userId1 === 'string' && userId1.length > 0, 'userId must be a non-empty string');
  
  const userId2 = await getOrCreateUserId();
  assert.strictEqual(userId1, userId2, 'userId should be persistent across calls');

  const context = await getUserContext();
  assert.strictEqual(context.key, userId1);
  assert.strictEqual(context.anonymous, true);
  assert.ok(context.custom && context.custom.platform);

  // Invalid event tracking
  assert.strictEqual(trackEvent(''), false);
  assert.strictEqual(trackEvent(null), false);

  // Degraded mode tracking returns false without throwing
  assert.strictEqual(trackEvent('video_view', { id: 'test123' }, 120), false);

  // Experiment variation fallback
  const variation = getExperimentVariation('ab-tubearchivist-ui', 'treatment');
  assert.strictEqual(variation, 'treatment');
});

test('LaunchDarkly Progressive Rollout - deterministic bucketing and threshold checks', async () => {
  const userId = await getOrCreateUserId();
  
  // 1. Bucket bounds and determinism
  const bucket1 = getRolloutBucket(userId, 'feat-test-1');
  assert.ok(Number.isInteger(bucket1));
  assert.ok(bucket1 >= 0 && bucket1 < 100, `Bucket ${bucket1} must be in [0, 99]`);

  const bucket2 = getRolloutBucket(userId, 'feat-test-1');
  assert.strictEqual(bucket1, bucket2, 'Bucketing must be 100% deterministic');

  // Bucketing with invalid inputs returns safe 0
  assert.strictEqual(getRolloutBucket(''), 0);
  assert.strictEqual(getRolloutBucket(null), 0);
  assert.strictEqual(getRolloutBucket(undefined), 0);

  // 2. Boundary percentages (0% and 100%)
  assert.strictEqual(isFeatureInRollout('test-zero-percent', 0, false), false);
  assert.strictEqual(isFeatureInRollout('test-hundred-percent', 100, false), true);

  // 3. Invalid flag key validation
  assert.strictEqual(isFeatureInRollout('', 50, false), false);
  assert.strictEqual(isFeatureInRollout(null, 50, true), true);

  // 4. Threshold consistency: if user is in bucket B, rollout > B must be true, rollout <= B must be false
  const testFlag = 'feature-canary-sample';
  const flagBucket = getRolloutBucket(userId, testFlag);
  
  if (flagBucket > 0) {
    assert.strictEqual(isFeatureInRollout(testFlag, flagBucket), false);
  }
  if (flagBucket < 99) {
    assert.strictEqual(isFeatureInRollout(testFlag, flagBucket + 1), true);
  }

  // 5. Global rollout status overview
  const status = getRolloutStatus();
  assert.strictEqual(status.userId, userId);
  assert.ok(status.userBucket >= 0 && status.userBucket < 100);
  assert.ok(status.flags && typeof status.flags === 'object');
  assert.ok(status.flags['enable-tubearchivist-features']);
  assert.ok(typeof status.flags['enable-tubearchivist-features'].enabled === 'boolean');
  assert.ok(status.flags['enable-tubearchivist-features'].targetPercentage === 50);

  // 6. User context enrichment for progressive targeting
  const context = await getUserContext();
  assert.ok(context.custom);
  assert.ok(context.custom.appVersion);
  assert.ok(context.custom.version);
  assert.ok(context.custom.channel);
  assert.ok(typeof context.custom.rolloutBucket === 'number');
  assert.ok(context.name && context.name.startsWith('User '));
});

test('LaunchDarkly Daily Rollout Progression - percentage increases over time', () => {
  const startDate = '2026-10-25';

  // J0 (same day): base percentage intact
  const d0 = new Date('2026-10-25T12:00:00Z');
  assert.strictEqual(calculateDailyRolloutPercentage(20, startDate, 20, d0), 20);

  // J1 (+1 day): base + 20% = 40%
  const d1 = new Date('2026-10-26T12:00:00Z');
  assert.strictEqual(calculateDailyRolloutPercentage(20, startDate, 20, d1), 40);

  // J2 (+2 days): base + 40% = 60%
  const d2 = new Date('2026-10-27T12:00:00Z');
  assert.strictEqual(calculateDailyRolloutPercentage(20, startDate, 20, d2), 60);

  // J4 (+4 days): base + 80% = 100% (GA)
  const d4 = new Date('2026-10-29T12:00:00Z');
  assert.strictEqual(calculateDailyRolloutPercentage(20, startDate, 20, d4), 100);

  // Cap at 100% after multiple days
  const d10 = new Date('2026-11-15T12:00:00Z');
  assert.strictEqual(calculateDailyRolloutPercentage(20, startDate, 20, d10), 100);

  // Non-active base (0%) stays 0%
  assert.strictEqual(calculateDailyRolloutPercentage(0, startDate, 20, d10), 0);

  // Invalid inputs handle gracefully
  assert.strictEqual(calculateDailyRolloutPercentage(30, 'invalid-date', 20), 30);
  assert.strictEqual(calculateDailyRolloutPercentage(30, startDate, 0), 30);

  // Release date extraction
  const releaseDate = getReleaseDate();
  assert.ok(typeof releaseDate === 'string' && releaseDate.match(/^\d{4}-\d{2}-\d{2}/));

  // Reporting contains dailyProgression object
  const status = getRolloutStatus();
  assert.ok(status.dailyProgression);
  assert.strictEqual(status.dailyProgression.enabled, true);
  assert.ok(typeof status.dailyProgression.dailyIncrement === 'number');
  assert.ok(typeof status.dailyProgression.daysSinceRelease === 'number');
});
