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

const args = process.argv.slice(2);

function getArgValue(flagName, defaultValue) {
  const index = args.indexOf(flagName);
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
    return args[index + 1];
  }
  return defaultValue;
}

const isDryRun = args.includes('--dry-run');
const projectKey = getArgValue('--project', process.env.LAUNCHDARKLY_PROJECT_KEY || 'default');
const environmentKey = getArgValue('--env', process.env.LAUNCHDARKLY_ENVIRONMENT || 'production');
const apiToken = getArgValue('--token', process.env.LAUNCHDARKLY_API_TOKEN || process.env.LD_ACCESS_TOKEN || '');
const dailyIncrement = parseInt(getArgValue('--increment', process.env.ROLLOUT_DAILY_INCREMENT || '20'), 10);

// Charger la date de release depuis patchnotes.json
let releaseDate = getArgValue('--date', null);
let appVersion = '2.1.18';

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
const rolloutFlags = [
  { key: 'enable-tubearchivist-features', name: 'TubeArchivist Features', basePercent: 50 },
  { key: 'ab-tubearchivist-ui', name: 'A/B TubeArchivist UI', basePercent: 50 },
  { key: 'auto-mark-watched', name: 'Auto-marquage 90%', basePercent: 25 },
  { key: 'enable-auto-subtitles', name: 'Sous-titres automatiques', basePercent: 25 },
  { key: 'enable-channel-autosync', name: 'Sync chaînes automatique', basePercent: 20 },
  { key: 'enable-comments-archive', name: 'Commentaires YouTube', basePercent: 10 }
];

function calculateDaysElapsed(fromDateStr) {
  const start = new Date(fromDateStr);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

const daysElapsed = calculateDaysElapsed(releaseDate);
const LD_API_BASE = 'https://app.launchdarkly.com/api/v2';

async function updateLaunchDarklyRollout(flagKey, percentage) {
  if (!apiToken) {
    return { success: false, reason: 'Pas de token API (mode simulation)' };
  }

  try {
    const weightOn = percentage * 1000;
    const weightOff = (100 - percentage) * 1000;

    const patchBody = {
      comment: `Progression journalière (+${dailyIncrement}%/j, jour ${daysElapsed} depuis ${releaseDate}) -> ${percentage}%`,
      instructions: [
        {
          kind: 'updateFallthrough',
          environmentKey,
          rollout: {
            variations: [
              { variation: 0, weight: weightOn },
              { variation: 1, weight: weightOff }
            ],
            bucketBy: 'key'
          }
        }
      ]
    };

    const res = await fetch(`${LD_API_BASE}/flags/${projectKey}/${flagKey}`, {
      method: 'PATCH',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json; domain-model=launchdarkly.semanticpatch',
        'LD-API-Version': 'beta'
      },
      body: JSON.stringify(patchBody)
    });

    if (res.status === 200) {
      return { success: true };
    } else {
      const err = await res.json().catch(() => ({}));
      return { success: false, reason: `HTTP ${res.status}: ${err.message || 'Erreur'}` };
    }
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

async function main() {
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

  for (const flag of rolloutFlags) {
    const effectivePercent = Math.min(100, flag.basePercent + (daysElapsed * dailyIncrement));
    const isGA = effectivePercent >= 100;
    const stage = isGA ? '100% (GA)' : `${effectivePercent}% (Progressif)`;

    let apiResult = null;
    if (apiToken && !isDryRun) {
      apiResult = await updateLaunchDarklyRollout(flag.key, effectivePercent);
    }

    results.push({
      key: flag.key,
      name: flag.name,
      base: flag.basePercent,
      effective: effectivePercent,
      isGA,
      stage,
      apiStatus: apiResult ? (apiResult.success ? '✓ Mis à jour' : `✗ ${apiResult.reason}`) : 'Calculé'
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

main();
