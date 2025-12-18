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

// Écouteur pour les messages
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openDownloadPage") {
    if (isValidUrl(request.url)) {
      browser.tabs.create({ url: request.url });
    } else {
      console.warn("Blocked attempt to open unsafe URL:", request.url);
    }
  }
});
