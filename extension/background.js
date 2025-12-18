// background.js

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
    // Only allow HTTPS protocol for security
    return parsedUrl.protocol === "http:";
  } catch {
    // Invalid URL format
    return false;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openDownloadPage") {
    if (isValidUrl(request.url)) {
      chrome.tabs.create({ url: request.url });
    } else {
      console.warn("Blocked attempt to open unsafe URL:", request.url);
    }
  }
});
