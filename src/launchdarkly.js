import { createRequire } from 'module';
import log from './logger.js';

const require = createRequire(import.meta.url);

let launchDarklyConfig = null;
try {
  launchDarklyConfig = require('../launchdarkly.config.cjs');
} catch {
  log.warn('launchdarkly.config.cjs absent : LaunchDarkly est désactivé.');
}

let ldClient = null;

export function initLaunchDarkly() {
  if (launchDarklyConfig && launchDarklyConfig.clientSideId && launchDarklyConfig.clientSideId.trim() !== '') {
    try {
      const LDElectron = require('launchdarkly-electron-client-sdk');
      const user = { key: 'anonymous-user', anonymous: true };
      
      ldClient = LDElectron.initializeInMain(
        launchDarklyConfig.clientSideId.trim(),
        user,
        {}
      );

      if (ldClient && typeof ldClient.on === 'function') {
        ldClient.on('ready', () => {
          log.info('LaunchDarkly client ready');
        });
        ldClient.on('error', (err) => {
          log.error(`LaunchDarkly error: ${err ? err.message || err : 'Unknown error'}`);
        });
      }
    } catch (err) {
      log.error(`Échec de l'initialisation de LaunchDarkly : ${err.message}`);
      ldClient = null;
    }
  } else {
    log.info('LaunchDarkly désactivé : clientSideId absent ou vide.');
  }
  return ldClient;
}

export function getLDClient() {
  return ldClient;
}

export function getFeatureFlag(key, defaultValue = false) {
  if (!ldClient) {
    return defaultValue;
  }
  try {
    if (typeof ldClient.variation === 'function') {
      return ldClient.variation(key, defaultValue);
    }
  } catch (err) {
    log.warn(`Erreur lors de la lecture du feature flag ${key} : ${err.message}`);
  }
  return defaultValue;
}

export function getAllFeatureFlags() {
  if (!ldClient) {
    return {};
  }
  try {
    if (typeof ldClient.allFlagsState === 'function') {
      const state = ldClient.allFlagsState();
      if (state && typeof state.allValues === 'function') {
        return state.allValues();
      }
      if (state && typeof state.toJSON === 'function') {
        return state.toJSON();
      }
      return state;
    }
  } catch (err) {
    log.warn(`Erreur lors de la récupération de l'état des feature flags : ${err.message}`);
  }
  return {};
}
