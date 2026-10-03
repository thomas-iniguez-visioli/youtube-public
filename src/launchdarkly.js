import { createRequire } from 'module';
import storage from 'electron-json-storage';
import log from './logger.js';

const require = createRequire(import.meta.url);

const STORAGE_KEY = 'launchdarkly-flags-cache';
const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second
const MAX_DELAY = 30000; // 30 seconds

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

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt) {
  const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
  // Add jitter (10%)
  return delay + (Math.random() * delay * 0.1);
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
  try {
    const LDElectron = require('launchdarkly-electron-client-sdk');
    
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
        return reject(new Error('Invalid LD client'));
      }

      // Setup event handlers
      ldClient.on('ready', () => {
        log.info('LaunchDarkly client ready');
        isInitialized = true;
        saveFlags(cachedFlags);
        resolve(ldClient);
      });

      ldClient.on('error', (err) => {
        const errorMsg = err ? err.message || err : 'Unknown error';
        log.error(`LaunchDarkly error: ${errorMsg}`);
        
        if (attempt < MAX_RETRIES) {
          const delay = getBackoffDelay(attempt);
          log.info(`Tentative de reconnexion dans ${delay}ms (tentative ${attempt + 1}/${MAX_RETRIES})`);
          setTimeout(() => {
            initializeWithRetry(clientId, user, options, attempt + 1)
              .then(resolve)
              .catch(reject);
          }, delay);
        } else {
          log.error(`Échec après ${MAX_RETRIES} tentatives`);
          reject(new Error(`LD initialization failed: ${errorMsg}`));
        }
      });

      ldClient.on('offline', () => {
        log.warn('LaunchDarkly offline - utilisant le cache local');
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
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = getBackoffDelay(attempt);
      log.warn(`Erreur initialization LaunchDarkly, retry dans ${delay}ms: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return initializeWithRetry(clientId, user, options, attempt + 1);
    }
    throw err;
  }
}

export async function initLaunchDarkly() {
  // Return existing promise if already initializing
  if (initializationPromise) {
    return initializationPromise;
  }

  if (!launchDarklyConfig || !launchDarklyConfig.clientSideId || launchDarklyConfig.clientSideId.trim() === '') {
    log.info('LaunchDarkly désactivé : clientSideId absent ou vide.');
    // Load cached flags even when disabled
    cachedFlags = await loadCachedFlags();
    return null;
  }

  initializationPromise = (async () => {
    try {
      // Load cached flags first for immediate availability
      cachedFlags = await loadCachedFlags();
      
      const user = { key: 'anonymous-user', anonymous: true };
      await initializeWithRetry(
        launchDarklyConfig.clientSideId.trim(),
        user,
        {}
      );
      return ldClient;
    } catch (err) {
      log.error(`Échec de l'initialisation de LaunchDarkly : ${err.message}`);
      ldClient = null;
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
