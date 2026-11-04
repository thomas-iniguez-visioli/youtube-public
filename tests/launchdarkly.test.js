import assert from 'node:assert';
import { test } from 'node:test';
import { initLaunchDarkly, getLDClient, getFeatureFlag, getAllFeatureFlags, isLaunchDarklyReady, reloadFlags, disableLaunchDarkly, isLaunchDarklyEnabled, getLaunchDarklyStatus, trackEvent, getExperimentVariation, getOrCreateUserId, getUserContext, getRolloutBucket, isFeatureInRollout, getRolloutStatus, calculateDailyRolloutPercentage, getReleaseDate } from '../src/launchdarkly.js';
import { rolloutFlags, buildFallthroughPatchPayload, fetchWithRetry, calculateDaysElapsed, updateLaunchDarklyRollout, createFlagIfMissing, isFlagAlreadyFullyRolledOut, fetchCurrentFlags, countApiFailures } from '../scripts/daily-rollout-progression.mjs';

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
  assert.strictEqual(status.flags['enable-tubearchivist-features'].targetPercentage, 50);
  assert.ok(status.flags['enable-notch-toast']);
  assert.ok(typeof status.flags['enable-notch-toast'].enabled === 'boolean');
  assert.strictEqual(status.flags['enable-notch-toast'].targetPercentage, 25);

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

test('LaunchDarkly JSON Patch payload builder generates RFC 6902 fallthrough replacements', () => {
  // Test 20%
  const payload20 = buildFallthroughPatchPayload(20, 'production');
  assert.strictEqual(payload20.length, 1);
  assert.strictEqual(payload20[0].op, 'replace');
  assert.strictEqual(payload20[0].path, '/environments/production/fallthrough');
  assert.deepStrictEqual(payload20[0].value, {
    rollout: {
      variations: [
        { variation: 0, weight: 20000 },
        { variation: 1, weight: 80000 }
      ],
      bucketBy: 'key'
    }
  });

  // Test 0%
  const payload0 = buildFallthroughPatchPayload(0, 'production');
  assert.deepStrictEqual(payload0[0].value.rollout.variations, [
    { variation: 0, weight: 0 },
    { variation: 1, weight: 100000 }
  ]);

  // Test 100%
  const payload100 = buildFallthroughPatchPayload(100, 'production');
  assert.deepStrictEqual(payload100[0].value.rollout.variations, [
    { variation: 0, weight: 100000 },
    { variation: 1, weight: 0 }
  ]);

  // Clamping test
  const clampedLow = buildFallthroughPatchPayload(-10, 'production');
  assert.strictEqual(clampedLow[0].value.rollout.variations[0].weight, 0);
  assert.strictEqual(clampedLow[0].value.rollout.variations[1].weight, 100000);

  const clampedHigh = buildFallthroughPatchPayload(120, 'staging');
  assert.strictEqual(clampedHigh[0].path, '/environments/staging/fallthrough');
  assert.strictEqual(clampedHigh[0].value.rollout.variations[0].weight, 100000);
  assert.strictEqual(clampedHigh[0].value.rollout.variations[1].weight, 0);

  // calculateDaysElapsed
  const diff = calculateDaysElapsed('2026-10-25', new Date('2026-10-27T10:00:00Z'));
  assert.strictEqual(diff, 2);
});

test('LaunchDarkly REST API fetchWithRetry retries on HTTP 429 with backoff', async () => {
  let callCount = 0;
  const mockFetch = async (url, options) => {
    callCount++;
    if (callCount < 2) {
      return {
        status: 429,
        headers: {
          get: (name) => (name.toLowerCase() === 'retry-after' ? '0' : null)
        }
      };
    }
    return {
      status: 200,
      json: async () => ({ ok: true })
    };
  };

  const res = await fetchWithRetry('https://fake-url.com', {}, 2, mockFetch);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(callCount, 2);
});

test('LaunchDarkly REST API auto-creates flag if HTTP 404 is encountered on patch', async () => {
  const flag = {
    key: 'enable-channel-autosync',
    name: 'Sync chaînes automatique',
    description: 'Analyse périodique des chaînes suivies',
    kind: 'boolean',
    basePercent: 20
  };

  const calls = [];
  const mockFetch = async (url, options) => {
    calls.push({ url, method: options.method });
    if (options.method === 'PATCH' && calls.length === 1) {
      // Premier PATCH: 404 (flag non existant)
      return {
        status: 404,
        json: async () => ({ code: 'not_found', message: 'Flag not found' })
      };
    }
    if (options.method === 'POST') {
      // Création automatique du flag
      return {
        status: 201,
        json: async () => ({ key: flag.key })
      };
    }
    if (options.method === 'PATCH' && calls.length === 3) {
      // Second PATCH après création réussie
      return {
        status: 200,
        json: async () => ({ ok: true })
      };
    }
    return { status: 500 };
  };

  const prevToken = process.env.LAUNCHDARKLY_API_TOKEN;
  process.env.LAUNCHDARKLY_API_TOKEN = 'mock-token-for-test';

  try {
    const result = await updateLaunchDarklyRollout(flag, 20, mockFetch, true);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.created, true);
    assert.strictEqual(calls.length, 3);
    assert.strictEqual(calls[0].method, 'PATCH');
    assert.strictEqual(calls[1].method, 'POST');
    assert.strictEqual(calls[2].method, 'PATCH');
  } finally {
    if (prevToken) {
      process.env.LAUNCHDARKLY_API_TOKEN = prevToken;
    } else {
      delete process.env.LAUNCHDARKLY_API_TOKEN;
    }
  }
});

test('LaunchDarkly feature flag enable-notch-toast is configured for progressive rollout', () => {
  const flag = rolloutFlags.find(f => f.key === 'enable-notch-toast');
  assert.ok(flag, 'enable-notch-toast doit être présent dans rolloutFlags');
  assert.strictEqual(flag.basePercent, 25);
  assert.strictEqual(flag.kind, 'boolean');
  assert.ok(flag.tags.includes('notch-toast'));

  // Test deterministic bucketing and rollout
  const res0 = isFeatureInRollout('enable-notch-toast', 0, false);
  assert.strictEqual(res0, false);

  const res100 = isFeatureInRollout('enable-notch-toast', 100, false);
  assert.strictEqual(res100, true);
});

test('isFlagAlreadyFullyRolledOut correctly identifies 100% (GA) feature flags', () => {
  // 1. Direct variation assignment (variation: 0 is on)
  assert.strictEqual(isFlagAlreadyFullyRolledOut({
    environments: {
      production: { fallthrough: { variation: 0 } }
    }
  }, 'production'), true);

  // Variation 1 (off) is not 100%
  assert.strictEqual(isFlagAlreadyFullyRolledOut({
    environments: {
      production: { fallthrough: { variation: 1 } }
    }
  }, 'production'), false);

  // 2. Rollout variations on 100,000 scale
  assert.strictEqual(isFlagAlreadyFullyRolledOut({
    environments: {
      production: {
        fallthrough: {
          rollout: {
            variations: [
              { variation: 0, weight: 100000 },
              { variation: 1, weight: 0 }
            ]
          }
        }
      }
    }
  }, 'production'), true);

  // Rollout variation 0 < 100000 (e.g. 50%)
  assert.strictEqual(isFlagAlreadyFullyRolledOut({
    environments: {
      production: {
        fallthrough: {
          rollout: {
            variations: [
              { variation: 0, weight: 50000 },
              { variation: 1, weight: 50000 }
            ]
          }
        }
      }
    }
  }, 'production'), false);

  // 3. Rollout variations on 100 scale
  assert.strictEqual(isFlagAlreadyFullyRolledOut({
    environments: {
      production: {
        fallthrough: {
          rollout: {
            variations: [
              { variation: 0, weight: 100 },
              { variation: 1, weight: 0 }
            ]
          }
        }
      }
    }
  }, 'production'), true);

  // 4. Non-standard or direct envData (fallback when environments key is omitted)
  assert.strictEqual(isFlagAlreadyFullyRolledOut({
    fallthrough: { variation: 0 }
  }), true);

  // 5. Environment scoping
  assert.strictEqual(isFlagAlreadyFullyRolledOut({
    environments: {
      staging: { fallthrough: { variation: 0 } },
      production: { fallthrough: { variation: 1 } }
    }
  }, 'production'), false);

  assert.strictEqual(isFlagAlreadyFullyRolledOut({
    environments: {
      staging: { fallthrough: { variation: 0 } },
      production: { fallthrough: { variation: 1 } }
    }
  }, 'staging'), true);

  // 6. Safe handling of invalid / null inputs
  assert.strictEqual(isFlagAlreadyFullyRolledOut(null), false);
  assert.strictEqual(isFlagAlreadyFullyRolledOut(undefined), false);
  assert.strictEqual(isFlagAlreadyFullyRolledOut({}), false);
  assert.strictEqual(isFlagAlreadyFullyRolledOut({ environments: {} }), false);
});

test('fetchCurrentFlags retrieves flags mapping from LaunchDarkly API', async () => {
  const prevToken = process.env.LAUNCHDARKLY_API_TOKEN;
  process.env.LAUNCHDARKLY_API_TOKEN = 'mock-token';

  try {
    const mockFetch = async (url, options) => {
      assert.ok(url.includes('/api/v2/flags/default?env=production'));
      assert.strictEqual(options.method, 'GET');
      return {
        status: 200,
        json: async () => ({
          items: [
            { key: 'enable-tubearchivist-features', environments: { production: { fallthrough: { variation: 0 } } } },
            { key: 'enable-notch-toast', environments: { production: { fallthrough: { rollout: { variations: [{ variation: 0, weight: 25000 }] } } } } }
          ]
        })
      };
    };

    const flagsMap = await fetchCurrentFlags(mockFetch);
    assert.strictEqual(flagsMap.size, 2);
    assert.ok(flagsMap.has('enable-tubearchivist-features'));
    assert.ok(flagsMap.has('enable-notch-toast'));
    assert.strictEqual(isFlagAlreadyFullyRolledOut(flagsMap.get('enable-tubearchivist-features')), true);
    assert.strictEqual(isFlagAlreadyFullyRolledOut(flagsMap.get('enable-notch-toast')), false);
  } finally {
    if (prevToken) {
      process.env.LAUNCHDARKLY_API_TOKEN = prevToken;
    } else {
      delete process.env.LAUNCHDARKLY_API_TOKEN;
    }
  }
});

test('updateLaunchDarklyRollout skips flags already at 100% (GA) without sending PATCH requests', async () => {
  const prevToken = process.env.LAUNCHDARKLY_API_TOKEN;
  process.env.LAUNCHDARKLY_API_TOKEN = 'mock-token';

  const flag = {
    key: 'enable-tubearchivist-features',
    name: 'TubeArchivist Features',
    basePercent: 50
  };

  const existingAt100 = {
    key: flag.key,
    environments: {
      production: {
        fallthrough: {
          variation: 0
        }
      }
    }
  };

  let patchCalled = false;
  const mockFetch = async (url, options) => {
    if (options.method === 'PATCH') {
      patchCalled = true;
    }
    return { status: 200, json: async () => ({}) };
  };

  try {
    // 1. With existingFlagData at 100% -> should skip PATCH
    const resultSkipped = await updateLaunchDarklyRollout(flag, 100, mockFetch, true, existingAt100);
    assert.strictEqual(resultSkipped.success, true);
    assert.strictEqual(resultSkipped.skipped, true);
    assert.strictEqual(resultSkipped.reason, 'Déjà à 100% (GA)');
    assert.strictEqual(patchCalled, false, 'No PATCH should be executed when flag is already 100%');

    // 2. With existingFlagData at 50% -> should execute PATCH
    const existingAt50 = {
      key: flag.key,
      environments: {
        production: {
          fallthrough: {
            rollout: {
              variations: [{ variation: 0, weight: 50000 }, { variation: 1, weight: 50000 }]
            }
          }
        }
      }
    };
    const resultPatched = await updateLaunchDarklyRollout(flag, 100, mockFetch, true, existingAt50);
    assert.strictEqual(resultPatched.success, true);
    assert.strictEqual(resultPatched.skipped, undefined);
    assert.strictEqual(patchCalled, true, 'PATCH must be executed when flag is not yet at 100%');
  } finally {
    if (prevToken) {
      process.env.LAUNCHDARKLY_API_TOKEN = prevToken;
    } else {
      delete process.env.LAUNCHDARKLY_API_TOKEN;
    }
  }
});

test('countApiFailures counts only real API failures (skipped and dry-run results excluded)', () => {
  // Résultats typiques du run quotidien : succès, ignoré (GA), échec, dry-run (null)
  const results = [
    { key: 'a', apiResult: { success: true } },
    { key: 'b', apiResult: { success: true, skipped: true, reason: 'Déjà à 100% (GA)' } },
    { key: 'c', apiResult: { success: false, reason: 'HTTP 401: Unauthorized' } },
    { key: 'd', apiResult: null }
  ];
  assert.strictEqual(countApiFailures(results), 1);

  // Aucun échec -> 0 (script exit code 0)
  assert.strictEqual(countApiFailures([
    { key: 'a', apiResult: { success: true } },
    { key: 'b', apiResult: null }
  ]), 0);

  // Entrées invalides traitées sans crash
  assert.strictEqual(countApiFailures([]), 0);
  assert.strictEqual(countApiFailures(null), 0);
});
