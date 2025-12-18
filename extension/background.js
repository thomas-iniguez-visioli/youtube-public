// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openDownloadPage") {
    chrome.tabs.create({ url: request.url });
  }
});