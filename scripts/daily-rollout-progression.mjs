/**
 * Script d'avancement automatique et journalier des déploiements progressifs LaunchDarkly
 * 
 * Utilisation :
 *   node scripts/daily-rollout-progression.mjs [OPTIONS]
 * 
 * Options :
 *   --token <API_TOKEN>        Token d'accès API LaunchDarkly (ou env LAUNCHDARKLY_API_TOKEN)
 *   --project <PROJECT_KEY>    Clé du projet LaunchDarkly (défaut: 'default')
 *   --env <ENV_KEY>            Environnement cible (défaut: 'production')
 *   --increment <PERCENT>      Pourcentage d'augmentation journalière (défaut: 20)
 *   --date <YYYY-MM-DD>        Date de release de référence (défaut: date dans patchnotes.json)
 *   --dry-run                  Calculer et afficher sans modifier l'API LaunchDarkly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);

function getArgValue(flagName, defaultValue) {
  const index = args.indexOf(flagName);
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
    return args[index + 1];
  }
  return defaultValue;
}

const isDryRun = args.includes('--dry-run');
export function getProjectKey() {
  return getArgValue('--project', process.env.LAUNCHDARKLY_PROJECT_KEY || 'default');
}
export function getEnvironmentKey() {
  return getArgValue('--env', process.env.LAUNCHDARKLY_ENVIRONMENT || 'production');
}
export function getApiToken() {
  return getArgValue('--token', process.env.LAUNCHDARKLY_API_TOKEN || process.env.LD_ACCESS_TOKEN || '');
}
const dailyIncrement = parseInt(getArgValue('--increment', process.env.ROLLOUT_DAILY_INCREMENT || '20'), 10);

// Charger la date de release depuis patchnotes.json
let releaseDate = getArgValue('--date', null);
let appVersion = '2.1.22';

try {
  const patchnotes = JSON.parse(fs.readFileSync('patchnotes.json', 'utf8'));
  if (Array.isArray(patchnotes) && patchnotes.length > 0) {
    if (!releaseDate && patchnotes[0].date) {
      releaseDate = patchnotes[0].date;
    }
    if (patchnotes[0].version) {
      appVersion = patchnotes[0].version;
    }
  }
} catch {
  // Ignorer si patchnotes introuvable
}

if (!releaseDate) {
  releaseDate = new Date().toISOString().slice(0, 10);
}

// Flags configurés pour le déploiement progressif quotidien
export const rolloutFlags = [
  {
    key: 'enable-tubearchivist-features',
    name: 'TubeArchivist Features',
    description: 'Kill-switch et déploiement progressif pour TubeArchivist',
    kind: 'boolean',
    variations: [
      { value: true, name: 'Activé' },
      { value: false, name: 'Désactivé' }
    ],
    defaults: { onVariation: 0, offVariation: 1 },
    tags: ['tubearchivist', 'feature', 'progressive-rollout'],
    basePercent: 50
  },
  {
    key: 'ab-tubearchivist-ui',
    name: 'A/B Test TubeArchivist UI',
    description: 'Expérimentation A/B : Interface TubeArchivist (badges, progression, filtres) vs classique',
    kind: 'multivariate',
    variations: [
      { value: 'archive', name: 'Archive (TubeArchivist)', description: 'Interface enrichie avec métadonnées et suivi' },
      { value: 'control', name: 'Control (Classique)', description: 'Interface historique' }
    ],
    defaults: { onVariation: 0, offVariation: 1 },
    tags: ['ab-test', 'tubearchivist', 'ui'],
    basePercent: 50
  },
  {
    key: 'auto-mark-watched',
    name: 'Auto-marquage des vidéos vues (90%)',
    description: 'Marque automatiquement une vidéo comme vue lorsque la lecture atteint 90%',
    kind: 'boolean',
    variations: [
      { value: true, name: 'Activé' },
      { value: false, name: 'Désactivé' }
    ],
    defaults: { onVariation: 0, offVariation: 1 },
    tags: ['tubearchivist', 'playback', 'progressive-rollout'],
    basePercent: 25
  },
  {
    key: 'enable-auto-subtitles',
    name: 'Téléchargement automatique des sous-titres',
    description: 'Télécharge et extrait automatiquement les pistes de sous-titres VTT',
    kind: 'boolean',
    variations: [
      { value: true, name: 'Activé' },
      { value: false, name: 'Désactivé' }
    ],
    defaults: { onVariation: 0, offVariation: 1 },
    tags: ['tubearchivist', 'subtitles', 'progressive-rollout'],
    basePercent: 25
  },
  {
    key: 'enable-channel-autosync',
    name: 'Synchronisation et téléchargement auto des chaînes',
    description: 'Analyse périodique des chaînes suivies et téléchargement des nouvelles vidéos',
    kind: 'boolean',
    variations: [
      { value: true, name: 'Activé' },
      { value: false, name: 'Désactivé' }
    ],
    defaults: { onVariation: 0, offVariation: 1 },
    tags: ['channels', 'sync', 'automation', 'progressive-rollout'],
    basePercent: 20
  },
  {
    key: 'enable-comments-archive',
    name: 'Archivage des commentaires YouTube',
    description: 'Télécharge et indexe les commentaires YouTube hors-ligne',
    kind: 'boolean',
    variations: [
      { value: true, name: 'Activé' },
      { value: false, name: 'Désactivé' }
    ],
    defaults: { onVariation: 0, offVariation: 1 },
    tags: ['tubearchivist', 'comments', 'progressive-rollout'],
    basePercent: 10
  }
,
  {
    key: 'enable-notch-toast',
    name: 'Notifications Notch Toast (Dynamic Island)',
    description: 'Notifications toasts style encoche / Dynamic Island inspirées de https://notch.devsethi.me/',
    kind: 'boolean',
    variations: [
      { value: true, name: 'Activé (Notch Toast)' },
      { value: false, name: 'Désactivé (Classique)' }
    ],
    defaults: { onVariation: 0, offVariation: 1 },
    tags: ['ui', 'notifications', 'notch-toast', 'progressive-rollout'],
    basePercent: 25
  }
];

export function calculateDaysElapsed(fromDateStr, referenceDate = new Date()) {
  const start = new Date(fromDateStr);
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const diffMs = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

const daysElapsed = calculateDaysElapsed(releaseDate);
const LD_API_BASE = 'https://app.launchdarkly.com/api/v2';

/**
 * Construit le payload JSON Patch standard (RFC 6902) pour la fallthrough rule LaunchDarkly.
 * Utilise des poids sur une base 100 000 (LaunchDarkly scale: 50000 = 50%).
 */
export function buildFallthroughPatchPayload(percentage, envKey = 'production') {
  const safePercentage = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
  const weightOn = safePercentage * 1000;
  const weightOff = (100 - safePercentage) * 1000;

  return [
    {
      op: 'replace',
      path: `/environments/${envKey}/fallthrough`,
      value: {
        rollout: {
          variations: [
            { variation: 0, weight: weightOn },
            { variation: 1, weight: weightOff }
          ],
          bucketBy: 'key'
        }
      }
    }
  ];
}

/**
 * Exécute un appel fetch avec gestion du rate limit HTTP 429 et backoff exponentiel.
 */
export async function fetchWithRetry(url, options, maxRetries = 3, customFetch = fetch) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await customFetch(url, options);
    if (res.status === 429) {
      if (attempt === maxRetries) {
        return res;
      }
      const retryAfterHeader = res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
      let retrySeconds;
      if (retryAfterHeader !== null && retryAfterHeader !== undefined) {
        const parsed = parseInt(retryAfterHeader, 10);
        retrySeconds = Number.isFinite(parsed) ? Math.max(0, parsed) : 2;
      } else {
        retrySeconds = (attempt + 1) * 2;
      }
      if (retrySeconds > 0) {
        console.warn(`[LaunchDarkly API] Limite de débit atteinte (HTTP 429), réessai dans ${retrySeconds}s (tentative ${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, retrySeconds * 1000));
      }
      continue;
    }
    return res;
  }
}

/**
 * Crée automatiquement un flag dans LaunchDarkly s'il n'existe pas encore.
 */
export async function createFlagIfMissing(flag, customFetch = fetch) {
  const apiToken = getApiToken();
  const projectKey = getProjectKey();

  if (!apiToken) {
    return { success: false, reason: 'Pas de token API (mode simulation)' };
  }

  const flagKey = typeof flag === 'string' ? flag : flag.key;
  const flagName = (typeof flag === 'object' && flag.name) || flagKey;
  const flagDesc = (typeof flag === 'object' && flag.description) || flagName;
  const kind = (typeof flag === 'object' && flag.kind) || 'boolean';
  const variations = (typeof flag === 'object' && flag.variations) || [
    { value: true, name: 'Activé' },
    { value: false, name: 'Désactivé' }
  ];
  const defaults = (typeof flag === 'object' && flag.defaults) || {
    onVariation: 0,
    offVariation: 1
  };
  const tags = (typeof flag === 'object' && flag.tags) || ['progressive-rollout'];

  try {
    const res = await fetchWithRetry(`${LD_API_BASE}/flags/${projectKey}`, {
      method: 'POST',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: flagKey,
        name: flagName,
        description: flagDesc,
        kind,
        variations,
        defaults,
        tags
      })
    }, 3, customFetch);

    if (res.status === 201 || res.status === 409) {
      return { success: true };
    }
    const err = await res.json().catch(() => ({}));
    const errMsg = err.message || err.code || err.error || `Erreur HTTP ${res.status}`;
    return { success: false, reason: errMsg };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

export async function updateLaunchDarklyRollout(flagOrKey, percentage, customFetch = fetch, allowAutoCreate = true) {
  const apiToken = getApiToken();
  const projectKey = getProjectKey();
  const environmentKey = getEnvironmentKey();

  if (!apiToken) {
    return { success: false, reason: 'Pas de token API (mode simulation)' };
  }

  const flagKey = typeof flagOrKey === 'string' ? flagOrKey : flagOrKey.key;
  const flagObj = typeof flagOrKey === 'object'
    ? flagOrKey
    : (rolloutFlags.find(f => f.key === flagKey) || { key: flagKey, name: flagKey });

  try {
    const patchBody = buildFallthroughPatchPayload(percentage, environmentKey);

    const res = await fetchWithRetry(`${LD_API_BASE}/flags/${projectKey}/${flagKey}`, {
      method: 'PATCH',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchBody)
    }, 3, customFetch);

    if (res.status === 200) {
      return { success: true };
    } else if (res.status === 404 && allowAutoCreate) {
      console.log(`[LaunchDarkly API] Flag introuvable '${flagKey}' (HTTP 404). Tentative de création automatique...`);
      const createRes = await createFlagIfMissing(flagObj, customFetch);
      if (createRes.success) {
        console.log(`[LaunchDarkly API] Flag '${flagKey}' créé avec succès. Application du rollout...`);
        await new Promise(r => setTimeout(r, 1200));
        const retryResult = await updateLaunchDarklyRollout(flagObj, percentage, customFetch, false);
        if (retryResult.success) {
          return { success: true, created: true };
        }
        return retryResult;
      } else {
        return { success: false, reason: `HTTP 404: Flag introuvable et création échouée (${createRes.reason})` };
      }
    } else {
      const err = await res.json().catch(() => ({}));
      const errMsg = err.message || err.code || err.error || 'Erreur';
      return { success: false, reason: `HTTP ${res.status}: ${errMsg}` };
    }
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

export async function main() {
  const apiToken = getApiToken();
  const projectKey = getProjectKey();
  const environmentKey = getEnvironmentKey();

  console.log(`============================================================`);
  console.log(`  LaunchDarkly - Progression Journalière des Déploiements   `);
  console.log(`============================================================`);
  console.log(`Version application : ${appVersion}`);
  console.log(`Date de mise en prod: ${releaseDate}`);
  console.log(`Jours écoulés       : ${daysElapsed} jour(s)`);
  console.log(`Incrément par jour  : +${dailyIncrement}%`);
  console.log(`Environnement cible : ${environmentKey}`);
  console.log(`Mode API cloud      : ${apiToken ? (isDryRun ? 'Simulation (--dry-run)' : 'Actif') : 'Hors-ligne (sans token)'}`);
  console.log(`------------------------------------------------------------\n`);

  const results = [];

  for (let i = 0; i < rolloutFlags.length; i++) {
    const flag = rolloutFlags[i];
    const effectivePercent = Math.min(100, flag.basePercent + (daysElapsed * dailyIncrement));
    const isGA = effectivePercent >= 100;
    const stage = isGA ? '100% (GA)' : `${effectivePercent}% (Progressif)`;

    let apiResult = null;
    if (apiToken && !isDryRun) {
      if (i > 0) {
        // Pause de 1.5s entre chaque requête pour éviter les rafales et respecter le débit d'API LaunchDarkly
        await new Promise(r => setTimeout(r, 1500));
      }
      apiResult = await updateLaunchDarklyRollout(flag, effectivePercent);
    }

    results.push({
      key: flag.key,
      name: flag.name,
      base: flag.basePercent,
      effective: effectivePercent,
      isGA,
      stage,
      apiStatus: apiResult ? (apiResult.success ? (apiResult.created ? '✓ Créé & Mis à jour' : '✓ Mis à jour') : `✗ ${apiResult.reason}`) : 'Calculé'
    });

    console.log(`[${flag.key}] Base: ${flag.basePercent}% -> Aujourd'hui: ${effectivePercent}% (${stage})`);
    if (apiResult && !apiResult.success) {
      console.warn(`  ! Note API: ${apiResult.reason}`);
    }
  }

  // Écrire dans le résumé GitHub Actions si disponible
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      const rows = results.map(r => `| \`${r.key}\` | ${r.base}% | **${r.effective}%** | ${r.stage} | ${r.apiStatus} |`).join('\n');
      const summaryMarkdown = `### 🚀 Progression Journalière du Déploiement Progressif LaunchDarkly

- **Version** : \`${appVersion}\`
- **Date de sortie** : \`${releaseDate}\` (${daysElapsed} jours écoulés)
- **Incrément journalier** : \`+${dailyIncrement}%\` par jour
- **Environnement** : \`${environmentKey}\`

| Feature Flag | % Initial | % Actuel (J+${daysElapsed}) | Statut | Résultat API |
| :--- | :---: | :---: | :---: | :---: |
${rows}
`;
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown);
    } catch (e) {
      console.warn('Impossible d\'écrire dans GITHUB_STEP_SUMMARY:', e.message);
    }
  }

  console.log(`\n============================================================`);
  console.log(`Progression journalière calculée avec succès.`);
  console.log(`============================================================\n`);
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main();
}
