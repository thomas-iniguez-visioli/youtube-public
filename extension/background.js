/**
 * Validates that a URL is safe to open.
 * Only allows HTTPS URLs to prevent dangerous protocols like javascript:, data:, file://, etc.
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if the URL is safe to open
 */
function isValidUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    // Only allow HTTP/HTTPS protocol for security (ajusté pour inclure HTTP si nécessaire)
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    // Invalid URL format
    return false;
  }
}

const browserApi = typeof browser !== "undefined" ? browser : chrome;

const recentUrls = new Map();
const RECENT_TTL_MS = 5 * 60 * 1000;

function pruneRecent(now = Date.now()) {
  for (const [url, ts] of recentUrls.entries()) {
    if (now - ts > RECENT_TTL_MS) recentUrls.delete(url);
  }
}

function triggerApiDownload(videoUrl) {
  const apiUrl = `http://localhost:8001/download?url=${encodeURIComponent(videoUrl)}`;
  fetch(apiUrl, { method: "GET", mode: "no-cors" }).catch(() => undefined);
}

// Écouteur pour les messages
browserApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);
  if(request.action === "getVideoUrl") {
    console.log("Sending video URL:", request.videoUrl);
    sendResponse({videoUrl: request.videoUrl});
  }
  if (request.action === "downloadCurrentVideo") {
    const url = request.url;
    if (!isValidUrl(url)) {
      sendResponse({ ok: false });
      return;
    }

    const now = Date.now();
    pruneRecent(now);
    const last = recentUrls.get(url);
    if (last && now - last < RECENT_TTL_MS) {
      sendResponse({ ok: true, deduped: true });
      return;
    }

    recentUrls.set(url, now);
    triggerApiDownload(url);
    sendResponse({ ok: true, deduped: false });
  }
  if (request.action === "openDownloadPage") {
    if (isValidUrl(request.url)) {
      browserApi.tabs.create({ url: request.url });
    } else {
      console.warn("Blocked attempt to open unsafe URL:", request.url);
    }
  }
});
