/**
 * Script de provisionnement et configuration du déploiement progressif LaunchDarkly
 * 
 * Utilisation :
 *   node scripts/setup-launchdarkly-flags.mjs <API_ACCESS_TOKEN> [PROJECT_KEY] [OPTIONS]
 * 
 * Options :
 *   --env <ENV_KEY>                    Environnement cible (défaut: 'production')
 *   --stage <canary|beta|half|ga>     Applique un stade de déploiement à tous les flags
 *   --rollout <FLAG_KEY> <PERCENT>    Modifie le pourcentage d'un flag spécifique (0-100)
 * 
 * Stades prédéfinis :
 *   canary  : 10%
 *   beta    : 25%
 *   half    : 50%
 *   ga      : 100% (Généralement disponible)
 */

const args = process.argv.slice(2);
const apiToken = args[0];
const projectKey = (args[1] && !args[1].startsWith('--')) ? args[1] : 'default';

if (!apiToken || apiToken.startsWith('--')) {
  console.error("Usage: node scripts/setup-launchdarkly-flags.mjs <API_ACCESS_TOKEN> [PROJECT_KEY] [OPTIONS]");
  console.error("Options:");
  console.error("  --env <environment>                 (ex: production)");
  console.error("  --stage <canary|beta|half|ga>       (définit le stade global)");
  console.error("  --rollout <flagKey> <percentage>   (pourcentage spécifique)");
  process.exit(1);
}

const LD_API_BASE = 'https://app.launchdarkly.com/api/v2';

// Parser les options CLI
function parseOptions() {
  const options = {
    env: 'production',
    stage: null,
    specificRollout: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env' && args[i + 1]) {
      options.env = args[i + 1];
    }
    if (args[i] === '--stage' && args[i + 1]) {
      options.stage = args[i + 1].toLowerCase();
    }
    if (args[i] === '--rollout' && args[i + 1] && args[i + 2]) {
      options.specificRollout = {
        key: args[i + 1],
        percent: Math.max(0, Math.min(100, parseInt(args[i + 2], 10)))
      };
    }
  }

  return options;
}

const options = parseOptions();

const STAGE_PERCENTAGES = {
  canary: 10,
  beta: 25,
  half: 50,
  ga: 100
};

const flagsToCreate = [
  {
    key: 'ab-tubearchivist-ui',
    name: 'A/B Test TubeArchivist UI',
    description: 'Expérimentation A/B : Interface TubeArchivist (badges, progression, filtres) vs classique',
    kind: 'multivariate',
    variations: [
      { value: 'archive', name: 'Archive (TubeArchivist)', description: 'Interface enrichie avec métadonnées et suivi' },
      { value: 'control', name: 'Control (Classique)', description: 'Interface historique' }
    ],
    defaults: {
      onVariation: 0,
      offVariation: 1
    },
    tags: ['ab-test', 'tubearchivist', 'ui'],
    defaultRolloutPercent: 50
  },
  {
    key: 'enable-tubearchivist-features',
    name: 'Activer les fonctionnalités TubeArchivist',
    description: 'Kill-switch et déploiement progressif pour TubeArchivist',
    kind: 'boolean',
    variations: [
      { value: true, name: 'Activé' },
      { value: false, name: 'Désactivé' }
    ],
    defaults: {
      onVariation: 0,
      offVariation: 1
    },
    tags: ['tubearchivist', 'feature', 'progressive-rollout'],
    defaultRolloutPercent: 50
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
    defaults: {
      onVariation: 0,
      offVariation: 1
    },
    tags: ['tubearchivist', 'playback', 'progressive-rollout'],
    defaultRolloutPercent: 25
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
    defaults: {
      onVariation: 0,
      offVariation: 1
    },
    tags: ['tubearchivist', 'subtitles', 'progressive-rollout'],
    defaultRolloutPercent: 25
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
    defaults: {
      onVariation: 0,
      offVariation: 1
    },
    tags: ['tubearchivist', 'comments', 'progressive-rollout'],
    defaultRolloutPercent: 10
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
    defaults: {
      onVariation: 0,
      offVariation: 1
    },
    tags: ['channels', 'sync', 'automation', 'progressive-rollout'],
    defaultRolloutPercent: 20
  }
];

async function createFlag(flag) {
  console.log(`Vérification / Création du flag : ${flag.key}...`);
  try {
    const res = await fetch(`${LD_API_BASE}/flags/${projectKey}`, {
      method: 'POST',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json',
        'LD-API-Version': 'beta'
      },
      body: JSON.stringify({
        key: flag.key,
        name: flag.name,
        description: flag.description,
        kind: flag.kind,
        variations: flag.variations,
        defaults: flag.defaults,
        tags: flag.tags
      })
    });

    if (res.status === 201) {
      console.log(`✓ Flag créé avec succès : ${flag.key}`);
    } else if (res.status === 409) {
      console.log(`ℹ Flag déjà existant : ${flag.key}`);
    } else {
      const err = await res.json().catch(() => ({}));
      console.error(`✗ Erreur création ${flag.key} (${res.status}):`, err.message || err);
    }
  } catch (err) {
    console.error(`✗ Échec requête pour ${flag.key}:`, err.message);
  }
}

async function configureRollout(flagKey, percent, envKey = 'production') {
  console.log(`Configuration du déploiement progressif pour ${flagKey} à ${percent}% (${envKey})...`);
  try {
    const weightOn = percent * 1000;
    const weightOff = (100 - percent) * 1000;

    const patchBody = {
      comment: `Déploiement progressif à ${percent}% configuré via setup script`,
      instructions: [
        {
          kind: 'updateFallthrough',
          environmentKey: envKey,
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
      console.log(`✓ Déploiement progressif de ${flagKey} mis à jour à ${percent}%`);
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn(`! Note PATCH rollout ${flagKey} (${res.status}):`, err.message || err);
    }
  } catch (err) {
    console.error(`✗ Échec configuration rollout ${flagKey}:`, err.message);
  }
}

async function main() {
  console.log(`=== Provisionnement et Déploiement Progressif LaunchDarkly ===`);
  console.log(`Projet       : ${projectKey}`);
  console.log(`Environnement: ${options.env}`);
  if (options.stage) {
    console.log(`Stade global : ${options.stage} (${STAGE_PERCENTAGES[options.stage] || 0}%)`);
  }
  console.log('------------------------------------------------------------\n');

  if (options.specificRollout) {
    await configureRollout(options.specificRollout.key, options.specificRollout.percent, options.env);
    console.log('\n=== Terminé ===');
    return;
  }

  for (const flag of flagsToCreate) {
    await createFlag(flag);

    let percent = flag.defaultRolloutPercent || 0;
    if (options.stage && typeof STAGE_PERCENTAGES[options.stage] === 'number') {
      percent = STAGE_PERCENTAGES[options.stage];
    }

    await configureRollout(flag.key, percent, options.env);
  }

  console.log('\n=== Terminé ===');
}

main();
