import { getProxyForUrl } from 'proxy-from-env';
import HttpsProxyAgent from 'https-proxy-agent';

const agentCache = new Map();

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
// Retourne undefined si aucun proxy : comportement direct inchangé.
function getHttpsAgent(targetUrl) {
  const proxy = proxyFor(targetUrl);
  if (!proxy) return undefined;
  if (!agentCache.has(proxy)) {
    agentCache.set(proxy, new HttpsProxyAgent(proxy));
  }
  return agentCache.get(proxy);
}

// Arguments yt-dlp : ['--proxy', url] si configuré, sinon [].
function ytProxyArgs(targetUrl = 'https://www.youtube.com') {
  const proxy = proxyFor(targetUrl);
  return proxy ? ['--proxy', proxy] : [];
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
  getChromiumProxyConfig
};
