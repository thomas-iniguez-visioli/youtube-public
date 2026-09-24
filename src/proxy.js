import { getProxyForUrl } from 'proxy-from-env';
import * as httpsProxyAgentNS from 'https-proxy-agent';

const agentCache = new Map();

// https-proxy-agent v5 exporte une factory + .HttpsProxyAgent,
// v7 exporte le constructeur nommé HttpsProxyAgent. Les deux cas supportés.
function resolveHttpsProxyAgentCtor() {
  const mod = httpsProxyAgentNS;
  return mod.HttpsProxyAgent
    || (mod.default && mod.default.HttpsProxyAgent)
    || (typeof mod.default === 'function' ? mod.default : null)
    || (typeof mod === 'function' ? mod : null);
}

function proxyFor(targetUrl) {
  try {
    return getProxyForUrl(targetUrl) || null;
  } catch (e) {
    return null;
  }
}

// URL du proxy pour une cible donnée, ou null si pas de proxy / NO_PROXY.
function getProxyFor(targetUrl) {
  return proxyFor(targetUrl);
}

// Agent https pour appels Node (https.get / https.request).
// Couvre aussi le téléchargement des binaires (yt-dlp/ffmpeg/deno) via updater.
// Retourne undefined si aucun proxy : comportement direct inchangé.
function getHttpsAgent(targetUrl) {
  const proxy = proxyFor(targetUrl);
  if (!proxy) return undefined;
  if (!agentCache.has(proxy)) {
    const Ctor = resolveHttpsProxyAgentCtor();
    if (typeof Ctor !== 'function') {
      throw new Error('https-proxy-agent : constructeur introuvable (v5/v7)');
    }
    agentCache.set(proxy, new Ctor(proxy));
  }
  return agentCache.get(proxy);
}

// Arguments yt-dlp : ['--proxy', url] si configuré, sinon [].
function ytProxyArgs(targetUrl = 'https://www.youtube.com') {
  const proxy = proxyFor(targetUrl);
  return proxy ? ['--proxy', proxy] : [];
}

// Variables d'env proxy pour les process enfants (yt-dlp lit aussi HTTP(S)_PROXY).
function ytProxyEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  const proxy = proxyFor('https://www.youtube.com');
  if (proxy) {
    env.HTTPS_PROXY = proxy;
    env.https_proxy = proxy;
    env.HTTP_PROXY = proxy;
    env.http_proxy = proxy;
  }
  return env;
}

// Config proxy Chromium/Electron (session.setProxy) pour electron-updater.
function getChromiumProxyConfig(targetUrl = 'https://www.youtube.com') {
  const proxy = proxyFor(targetUrl);
  if (!proxy) return null;
  const raw = process.env.NO_PROXY || process.env.no_proxy || '';
  const entries = raw.split(/[,\s]+/).filter(Boolean);
  // L'app locale (localhost:8001) ne doit jamais passer par le proxy.
  const bypass = new Set([...entries, 'localhost', '127.0.0.1']);
  return {
    mode: 'fixed_servers',
    proxyRules: proxy,
    proxyBypassRules: [...bypass].join(';')
  };
}

export {
  getProxyFor,
  getHttpsAgent,
  ytProxyArgs,
  ytProxyEnv,
  getChromiumProxyConfig
};
