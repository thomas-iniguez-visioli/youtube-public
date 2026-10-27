import { createRequire } from 'module';
import crypto from 'crypto';
import log from './logger.js';

const require = createRequire(import.meta.url);

const STORAGE_KEY = 'launchdarkly-flags-cache';
const USER_ID_KEY = 'launchdarkly-user-id';
let currentUserId = null;

/**
 * Récupère ou génère un identifiant anonyme persistant pour les tests A/B
 */
export function getOrCreateUserId() {
  if (currentUserId) return Promise.resolve(currentUserId);
  return new Promise((resolve) => {
    storage.get(USER_ID_KEY, (err, data) => {
      if (!err && data && typeof data.id === 'string' && data.id.trim()) {
        currentUserId = data.id.trim();
        resolve(currentUserId);
      } else {
        const newId = crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        currentUserId = newId;
        storage.set(USER_ID_KEY, { id: newId }, () => resolve(newId));
      }
    });
  });
}

let appVersion = '2.1.17';
try {
  const pkg = require('../package.json');
  if (pkg && pkg.version) appVersion = pkg.version;
} catch {}

export function getCurrentUserId() {
  return currentUserId || 'anonymous-user';
}

/**
 * Calcule un bucket déterministe entre 0 et 99 pour un utilisateur et un salage (flag) donné.
 * Permet un partitionnement pseudo-aléatoire mais reproductible pour les déploiements progressifs.
 *
 * @param {string} userId - Identifiant persistant de l'utilisateur
 * @param {string} [salt=''] - Salage optionnel (généralement la clé du feature flag)
 * @returns {number} Entier compris entre 0 et 99
 */
export function getRolloutBucket(userId, salt = '') {
  if (!userId || typeof userId !== 'string') return 0;
  const hash = crypto.createHash('sha256').update(`${userId}:${salt}`).digest('hex');
  const intVal = parseInt(hash.substring(0, 8), 16);
  return intVal % 100;
}

export async function getUserContext() {
  const userId = await getOrCreateUserId();
  const bucket = getRolloutBucket(userId);
  const channel = process.env.RELEASE_CHANNEL || (launchDarklyConfig && launchDarklyConfig.channel) || 'stable';
  return {
    key: userId,
    anonymous: true,
    name: `User ${userId.slice(0, 8)}`,
    custom: {
      platform: process.platform,
      arch: process.arch,
      appVersion: appVersion,
      version: appVersion,
      channel: channel,
      rolloutBucket: bucket
    }
  };
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second
const MAX_DELAY = 30000; // 30 seconds

// Storage optionnel : si le paquet n'est pas installé, on bascule sur un
// cache en mémoire au lieu de faire planter le démarrage de l'application.
let storage;
try {
  storage = require('electron-json-storage');
} catch (err) {
  log.warn(`electron-json-storage indisponible (${err.code || err.message}) : cache LaunchDarkly en mémoire.`);
  const memoryStore = new Map();
  storage = {
    get: (key, cb) => cb(null, memoryStore.get(key) || {}),
    set: (key, value, cb) => {
      try { memoryStore.set(key, JSON.parse(JSON.stringify(value))); } catch (e) { memoryStore.set(key, value); }
      if (cb) cb(null);
    }
  };
}

let launchDarklyConfig = null;
try {
  launchDarklyConfig = require('../launchdarkly.config.cjs');
} catch {
  log.warn('launchdarkly.config.cjs absent : LaunchDarkly est désactivé.');
}

let ldClient = null;
let cachedFlags = {};
let isInitialized = false;
let initializationPromise = null;

// État "indisponible" : dès qu'on ne peut pas utiliser LaunchDarkly (config
// absente, SDK manquant, réseau injoignable), on le désactive pour la session
// au lieu de réessayer en boucle.
let disabled = false;
let disabledReason = null;
let retryTimer = null;

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt) {
  const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
  // Add jitter (10%)
  return delay + (Math.random() * delay * 0.1);
}

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function closeClient() {
  const client = ldClient;
  ldClient = null;
  if (client && typeof client.close === 'function') {
    try {
      const p = client.close();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      // Le client peut déjà être fermé
    }
  }
}

/**
 * Désactive LaunchDarkly pour toute la session (aucune nouvelle tentative réseau).
 */
export function disableLaunchDarkly(reason) {
  if (disabled) return;
  disabled = true;
  disabledReason = reason || 'indisponible';
  isInitialized = false;
  clearRetryTimer();
  closeClient();
  log.warn(`LaunchDarkly désactivé : ${disabledReason}`);
}

export function isLaunchDarklyEnabled() {
  return !disabled;
}

export function getLaunchDarklyStatus() {
  return {
    enabled: !disabled,
    reason: disabledReason,
    ready: isInitialized && ldClient !== null
  };
}

/**
 * Load cached flags from persistent storage
 */
function loadCachedFlags() {
  return new Promise((resolve) => {
    storage.get(STORAGE_KEY, (err, data) => {
      if (err) {
        log.warn(`Erreur chargement cache LaunchDarkly: ${err.message}`);
        resolve({});
      } else {
        log.info(`Cache LaunchDarkly chargé: ${Object.keys(data || {}).length} flags`);
        resolve(data || {});
      }
    });
  });
}

/**
 * Save flags to persistent storage
 */
function saveFlags(flags) {
  return new Promise((resolve) => {
    storage.set(STORAGE_KEY, flags, (err) => {
      if (err) {
        log.warn(`Erreur sauvegarde cache LaunchDarkly: ${err.message}`);
      }
      resolve();
    });
  });
}

/**
 * Initialize LaunchDarkly client with retry logic
 */
async function initializeWithRetry(clientId, user, options = {}, attempt = 0) {
  if (disabled) {
    throw new Error(`LaunchDarkly désactivé : ${disabledReason}`);
  }

  let LDElectron;
  try {
    LDElectron = require('launchdarkly-electron-client-sdk');
  } catch (err) {
    // Paquet absent/inaccessible : inutile de réessayer, on désactive directement
    disableLaunchDarkly(`SDK launchdarkly-electron-client-sdk indisponible (${err.code || err.message})`);
    throw new Error(`LaunchDarkly désactivé : ${disabledReason}`);
  }

  // Un nouveau client remplace le précédent : sinon chaque tentative échouée
  // laissait un client vivant qui relançait sa propre chaîne de retries.
  closeClient();

  // Configure options for better performance
  const ldOptions = {
    ...options,
    // Use electron-json-storage for persistence
    storage: {
      ...(options.storage || {}),
    },
    // Enable streaming for real-time updates
    stream: true,
    // Timeout configuration
    timeout: 5000,
  };

  ldClient = LDElectron.initializeInMain(clientId, user, ldOptions);

  return new Promise((resolve, reject) => {
    if (!ldClient || typeof ldClient.on !== 'function') {
      disableLaunchDarkly('client LaunchDarkly invalide');
      return reject(new Error(`LaunchDarkly désactivé : ${disabledReason}`));
    }

    // Backoff : nouvelle tentative plus tard, ou désactivation si on a épuisé
    // les tentatives ou si LaunchDarkly a été désactivé entre-temps.
    const retryOrDisable = (err, context) => {
      const message = err ? (err.message || String(err)) : 'Erreur inconnue';

      if (disabled) {
        return reject(new Error(`LaunchDarkly désactivé : ${disabledReason}`));
      }
      if (attempt >= MAX_RETRIES) {
        disableLaunchDarkly(`indisponible (${context}: ${message})`);
        return reject(new Error(`LaunchDarkly désactivé : ${disabledReason}`));
      }

      const delay = getBackoffDelay(attempt);
      log.info(`LaunchDarkly ${context} (${message}) - tentative ${attempt + 1}/${MAX_RETRIES} dans ${Math.round(delay)}ms`);
      clearRetryTimer();
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (disabled) {
          return reject(new Error(`LaunchDarkly désactivé : ${disabledReason}`));
        }
        initializeWithRetry(clientId, user, options, attempt + 1).then(resolve, reject);
      }, delay);
    };

    // Setup event handlers
    ldClient.on('ready', () => {
      log.info('LaunchDarkly client ready');
      isInitialized = true;
      clearRetryTimer();
      saveFlags(cachedFlags);
      resolve(ldClient);
    });

    ldClient.on('error', (err) => {
      log.error(`LaunchDarkly error: ${err ? err.message || err : 'Unknown error'}`);
      retryOrDisable(err, 'erreur');
    });

    ldClient.on('offline', () => {
      log.warn('LaunchDarkly offline - utilisant le cache local');
      if (!isInitialized) {
        // Jamais connecté : on compte ça comme une tentative échouée
        retryOrDisable(new Error('connexion impossible'), 'offline');
      }
    });

    ldClient.on('update', (flags) => {
      log.debug('LaunchDarkly flags updated');
      cachedFlags = { ...cachedFlags, ...flags };
      saveFlags(cachedFlags);
    });

    // Also listen for failed updates
    ldClient.on('failed', (err) => {
      log.warn(`Échec mise à jour LaunchDarkly: ${err ? err.message || err : 'Erreur inconnue'}`);
    });
  });
}

export async function initLaunchDarkly() {
  // Return existing promise if already initializing
  if (initializationPromise) {
    return initializationPromise;
  }

  if (!launchDarklyConfig || !launchDarklyConfig.clientSideId || launchDarklyConfig.clientSideId.trim() === '') {
    disableLaunchDarkly('clientSideId absent ou vide');
    // Load cached flags even when disabled
    try {
      cachedFlags = await loadCachedFlags();
    } catch (err) {
      log.warn(`Erreur chargement cache LaunchDarkly: ${err.message}`);
      cachedFlags = {};
    }
    return null;
  }

  initializationPromise = (async () => {
    try {
      // Load cached flags first for immediate availability
      cachedFlags = await loadCachedFlags();

      if (disabled) {
        log.info(`LaunchDarkly désactivé avant initialisation : ${disabledReason}`);
        return null;
      }

      const user = await getUserContext();
      await initializeWithRetry(
        launchDarklyConfig.clientSideId.trim(),
        user,
        {}
      );
      return ldClient;
    } catch (err) {
      log.error(`Échec de l'initialisation de LaunchDarkly : ${err.message}`);
      disableLaunchDarkly(err.message);
      return null;
    }
  })();

  return initializationPromise;
}

export function getLDClient() {
  return ldClient;
}

export function isLaunchDarklyReady() {
  return isInitialized && ldClient !== null;
}

export function getFeatureFlag(key, defaultValue = false) {
  // Type validation
  if (typeof key !== 'string' || key.trim() === '') {
    log.warn(`Clé de feature flag invalide: ${key}`);
    return defaultValue;
  }

  try {
    // If client is ready, use it
    if (ldClient && typeof ldClient.variation === 'function') {
      return ldClient.variation(key, defaultValue);
    }

    // Fallback to cached flags
    if (cachedFlags && typeof cachedFlags[key] !== 'undefined') {
      const cachedValue = cachedFlags[key];
      // Validate cached value type matches expected default type
      if (typeof cachedValue === typeof defaultValue) {
        return cachedValue;
      }
      log.warn(`Type mismatch pour le flag ${key}: attendu ${typeof defaultValue}, obtenu ${typeof cachedValue}`);
    }
  } catch (err) {
    log.warn(`Erreur lors de la lecture du feature flag ${key} : ${err.message}`);
  }

  // Final fallback to default value
  return defaultValue;
}

export function getAllFeatureFlags() {
  try {
    // If client is ready, get live flags
    if (ldClient && typeof ldClient.allFlagsState === 'function') {
      const state = ldClient.allFlagsState();
      if (state && typeof state.allValues === 'function') {
        const flags = state.allValues();
        // Update cache with live flags
        cachedFlags = { ...cachedFlags, ...flags };
        return flags;
      }
      if (state && typeof state.toJSON === 'function') {
        return state.toJSON();
      }
      return state;
    }

    // Return cached flags if client not ready
    if (cachedFlags && typeof cachedFlags === 'object') {
      return { ...cachedFlags };
    }
  } catch (err) {
    log.warn(`Erreur lors de la récupération de l'état des feature flags : ${err.message}`);
  }

  return {};
}

/**
 * Force reload flags from LaunchDarkly server
 */
export async function reloadFlags() {
  if (disabled) {
    log.info(`Rechargement des flags ignoré : LaunchDarkly désactivé (${disabledReason})`);
    return;
  }
  if (!ldClient || typeof ldClient.flush !== 'function') {
    log.warn('Impossible de recharger les flags: client non prêt');
    return;
  }

  try {
    await ldClient.flush();
    log.info('LaunchDarkly flags rechargés');
  } catch (err) {
    log.warn(`Erreur rechargement flags: ${err.message}`);
  }
}


/**
 * Track an event for LaunchDarkly A/B testing / Experimentation
 * @param {string} eventName - Nom de l'événement de conversion ou métrique
 * @param {object} [data] - Métadonnées associées à l'événement
 * @param {number} [metricValue] - Valeur numérique de la métrique (ex: durée, score)
 */
export function trackEvent(eventName, data = {}, metricValue = undefined) {
  if (typeof eventName !== 'string' || !eventName.trim()) {
    log.warn(`Nom d'événement A/B invalide: ${eventName}`);
    return false;
  }

  const cleanEvent = eventName.trim();
  try {
    if (ldClient && typeof ldClient.track === 'function') {
      if (typeof metricValue === 'number' && Number.isFinite(metricValue)) {
        ldClient.track(cleanEvent, data, metricValue);
      } else {
        ldClient.track(cleanEvent, data);
      }
      log.debug(`[LaunchDarkly A/B] Événement tracké: ${cleanEvent}`, data);
      return true;
    } else {
      log.debug(`[LaunchDarkly A/B] Événement non envoyé (client non prêt): ${cleanEvent}`);
    }
  } catch (err) {
    log.warn(`Erreur lors du tracking LaunchDarkly (${cleanEvent}) : ${err.message}`);
  }
  return false;
}

/**
 * Récupère la variation A/B attribuée pour un feature flag donné
 * @param {string} flagKey - Clé du feature flag d'expérimentation
 * @param {any} [defaultVariation='control'] - Variation par défaut
 */
export function getExperimentVariation(flagKey, defaultVariation = 'control') {
  return getFeatureFlag(flagKey, defaultVariation);
}

/**
 * Évalue si une fonctionnalité doit être activée pour l'utilisateur actuel dans le cadre
 * d'un déploiement progressif (percentage / canary rollout).
 *
 * Ordre d'évaluation :
 * 1. Client LaunchDarkly connecté (Live SDK) :
 *    - Si le flag retourne un booléen (règle de ciblage ou variation de pourcentage évaluée côté LD) : on l'utilise.
 *    - Si le flag retourne un nombre (pourcentage 0-100) : on compare avec le bucket de l'utilisateur.
 * 2. Cache local des flags LaunchDarkly (mode hors-ligne) :
 *    - Même logique si présent dans le cache (booléen ou pourcentage).
 * 3. Fallback progressif déterministe (sans connexion LaunchDarkly) :
 *    - Utilise le pourcentage configuré dans launchDarklyConfig.defaultRollouts[flagKey] ou defaultRolloutPercent.
 *    - Compare avec le bucket déterministe de l'utilisateur calculé sur (userId:flagKey).
 *
 * @param {string} flagKey - Clé du feature flag
 * @param {number} [defaultRolloutPercent=0] - Pourcentage de déploiement par défaut (0 à 100)
 * @param {boolean} [defaultValue=false] - Valeur de secours si le pourcentage est à 0
 * @returns {boolean} true si la fonctionnalité est activée pour cet utilisateur
 */
export function isFeatureInRollout(flagKey, defaultRolloutPercent = 0, defaultValue = false) {
  if (typeof flagKey !== 'string' || !flagKey.trim()) {
    log.warn(`Clé de feature flag invalide pour le déploiement progressif: ${flagKey}`);
    return defaultValue;
  }

  const cleanKey = flagKey.trim();
  const userId = getCurrentUserId();

  // 1. Live LaunchDarkly SDK
  if (ldClient && typeof ldClient.variation === 'function') {
    try {
      const liveVal = ldClient.variation(cleanKey, null);
      if (typeof liveVal === 'boolean') {
        return liveVal;
      }
      if (typeof liveVal === 'number' && Number.isFinite(liveVal)) {
        const bucket = getRolloutBucket(userId, cleanKey);
        return bucket < Math.max(0, Math.min(100, liveVal));
      }
    } catch (err) {
      log.warn(`Erreur lors de l'évaluation LaunchDarkly de ${cleanKey} : ${err.message}`);
    }
  }

  // 2. Cache local des flags LaunchDarkly
  if (cachedFlags && typeof cachedFlags[cleanKey] !== 'undefined') {
    const cachedVal = cachedFlags[cleanKey];
    if (typeof cachedVal === 'boolean') {
      return cachedVal;
    }
    if (typeof cachedVal === 'number' && Number.isFinite(cachedVal)) {
      const bucket = getRolloutBucket(userId, cleanKey);
      return bucket < Math.max(0, Math.min(100, cachedVal));
    }
  }

  // 3. Fallback progressif déterministe (hors-ligne ou configuration locale)
  const configRollouts = (launchDarklyConfig && launchDarklyConfig.defaultRollouts) || {};
  let targetPercent = defaultRolloutPercent;
  if (typeof configRollouts[cleanKey] === 'number') {
    targetPercent = configRollouts[cleanKey];
  }

  const percent = Math.max(0, Math.min(100, Number(targetPercent) || 0));
  if (percent <= 0) return defaultValue;
  if (percent >= 100) return true;

  const bucket = getRolloutBucket(userId, cleanKey);
  return bucket < percent;
}

/**
 * Retourne l'état complet du déploiement progressif pour l'utilisateur actuel.
 */
export function getRolloutStatus() {
  const userId = getCurrentUserId();
  const userBucket = getRolloutBucket(userId);
  const configRollouts = (launchDarklyConfig && launchDarklyConfig.defaultRollouts) || {};

  const knownRollouts = {
    'enable-tubearchivist-features': 50,
    'ab-tubearchivist-ui': 50,
    'auto-mark-watched': 25,
    'enable-auto-subtitles': 25,
    'enable-comments-archive': 10,
    'enable-channel-autosync': 20,
    ...configRollouts
  };

  const flagsStatus = {};
  for (const [key, defaultPct] of Object.entries(knownRollouts)) {
    const flagBucket = getRolloutBucket(userId, key);
    const enabled = isFeatureInRollout(key, defaultPct, false);
    flagsStatus[key] = {
      enabled,
      flagBucket,
      targetPercentage: typeof configRollouts[key] === 'number' ? configRollouts[key] : defaultPct,
      source: (ldClient && typeof ldClient.variation === 'function') ? 'launchdarkly-live' : 'deterministic-rollout'
    };
  }

  return {
    userId,
    userBucket,
    launchDarklyEnabled: isLaunchDarklyEnabled(),
    launchDarklyReady: isLaunchDarklyReady(),
    channel: process.env.RELEASE_CHANNEL || (launchDarklyConfig && launchDarklyConfig.channel) || 'stable',
    flags: flagsStatus
  };
}
