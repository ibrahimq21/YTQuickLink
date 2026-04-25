// YTQuickLink - Background script
// Fixed: storage for persistence, message handling

var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);

// Current stored URL
var currentModifiedUrl = '';
var currentVideoId = '';

// Save to storage
function saveUrl(data) {
  currentModifiedUrl = data.modifiedUrl || '';
  currentVideoId = data.videoId || '';
  
  // Also save to browser storage for persistence
  if (runtimeAPI && runtimeAPI.storage && runtimeAPI.storage.local) {
    runtimeAPI.storage.local.set({
      modifiedUrl: currentModifiedUrl,
      videoId: currentVideoId
    });
  }
}

// Load from storage on startup
function loadSavedUrl() {
  if (runtimeAPI && runtimeAPI.storage && runtimeAPI.storage.local) {
    runtimeAPI.storage.local.get(['modifiedUrl', 'videoId']).then(function(items) {
      if (items.modifiedUrl) {
        currentModifiedUrl = items.modifiedUrl;
        currentVideoId = items.videoId || '';
      }
    }).catch(function() {});
  }
}

// Initialize storage
loadSavedUrl();

// Listen for messages from content/popup
if (runtimeAPI && runtimeAPI.onMessage) {
  runtimeAPI.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'thumbnailClicked' || request.action === 'videoNavigate') {
      saveUrl(request);
    }
    if (request.action === 'videoChanged') {
      saveUrl(request);
    }
    if (request.action === 'getStoredUrl') {
      sendResponse({ modifiedUrl: currentModifiedUrl, videoId: currentVideoId });
      return true;
    }
  });
}

// Extension install
if (runtimeAPI && runtimeAPI.onInstalled) {
  runtimeAPI.onInstalled.addListener(function(details) {
    console.log('YTQuickLink installed/updated');
  });
}