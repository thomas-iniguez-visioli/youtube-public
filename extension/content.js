const browserApi = typeof browser !== "undefined" ? browser : chrome;

function getCurrentUrl() {
  return window.location.href;
}

function isYouTubeVideoUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/(\.|^)youtube\.com$/i.test(parsed.hostname)) return false;
    if (parsed.pathname === "/watch" && parsed.searchParams.get("v")) return true;
    if (parsed.pathname.startsWith("/shorts/")) return true;
    return false;
  } catch {
    return false;
  }
}

function normalizeYouTubeUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  if (parsed.pathname === "/watch") {
    const v = parsed.searchParams.get("v");
    parsed.search = "";
    if (v) parsed.searchParams.set("v", v);
  }
  return parsed.toString();
}

let lastUrl = getCurrentUrl();
let lastSentUrl = null;
let debounceTimer = null;

function maybeDownloadCurrentVideo() {
  const current = getCurrentUrl();
  if (!isYouTubeVideoUrl(current)) return;
  const normalized = normalizeYouTubeUrl(current);
  if (normalized === lastSentUrl) return;
  lastSentUrl = normalized;
  browserApi.runtime.sendMessage({ action: "downloadCurrentVideo", url: normalized, pageUrl: current });
}

function onUrlChange() {
  const next = getCurrentUrl();
  if (next === lastUrl) return;
  lastUrl = next;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    maybeDownloadCurrentVideo();
  }, 750);
}

const originalPushState = history.pushState;
history.pushState = function (...args) {
  const ret = originalPushState.apply(this, args);
  window.dispatchEvent(new Event("yt-extension-urlchange"));
  return ret;
};

const originalReplaceState = history.replaceState;
history.replaceState = function (...args) {
  const ret = originalReplaceState.apply(this, args);
  window.dispatchEvent(new Event("yt-extension-urlchange"));
  return ret;
};

window.addEventListener("yt-extension-urlchange", onUrlChange);
window.addEventListener("popstate", onUrlChange);
setInterval(onUrlChange, 1000);

browserApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getVideoUrl") {
    sendResponse({ videoUrl: getCurrentUrl() });
  }
});

setTimeout(() => {
  maybeDownloadCurrentVideo();
}, 1000);
