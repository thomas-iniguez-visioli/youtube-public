/**
 * Script de provisionnement automatique des Feature Flags et Métriques LaunchDarkly
 * 
 * Utilisation :
 *   node scripts/setup-launchdarkly-flags.mjs <API_ACCESS_TOKEN> <PROJECT_KEY>
 * 
 * Pour obtenir un token d'API :
 *   LaunchDarkly -> Account settings -> Authorization -> Access tokens -> Create token (Role: Writer ou Admin)
 */

const [,, apiToken, projectKey = 'default'] = process.argv;

if (!apiToken) {
  console.error("Usage: node scripts/setup-launchdarkly-flags.mjs <API_ACCESS_TOKEN> [PROJECT_KEY]");
  console.error("Veuillez fournir un Access Token LaunchDarkly valide.");
  process.exit(1);
}

const LD_API_BASE = 'https://app.launchdarkly.com/api/v2';

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
    tags: ['ab-test', 'tubearchivist', 'ui']
  },
  {
    key: 'enable-tubearchivist-features',
    name: 'Activer les fonctionnalités TubeArchivist',
    description: 'Kill-switch pour les fonctionnalités complètes de TubeArchivist',
    kind: 'boolean',
    variations: [
      { value: true, name: 'Activé' },
      { value: false, name: 'Désactivé' }
    ],
    defaults: {
      onVariation: 0,
      offVariation: 1
    },
    tags: ['tubearchivist', 'feature']
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
    tags: ['tubearchivist', 'playback']
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
    tags: ['tubearchivist', 'subtitles']
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
    tags: ['tubearchivist', 'comments']
  }
];

async function createFlag(flag) {
  console.log(`Création du flag : ${flag.key}...`);
  try {
    const res = await fetch(`${LD_API_BASE}/flags/${projectKey}`, {
      method: 'POST',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json',
        'LD-API-Version': 'beta'
      },
      body: JSON.stringify(flag)
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

async function main() {
  console.log(`=== Provisionnement LaunchDarkly (Projet: ${projectKey}) ===\n`);
  for (const flag of flagsToCreate) {
    await createFlag(flag);
  }
  console.log('\n=== Terminé ===');
}

main();
