// content.js
function getCurrentVideoUrl() {
  return window.location.href;
}

background.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getVideoUrl") {
    sendResponse({ videoUrl: getCurrentVideoUrl() });
  }
});