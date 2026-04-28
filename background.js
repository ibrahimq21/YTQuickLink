// YTQuickLink - Background script
var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);

// Unified async storage wrapper
var api = {
  storage: {
    get: function(keys) {
      return runtimeAPI.storage.local.get(keys);
    },
    set: function(data) {
      return runtimeAPI.storage.local.set(data);
    }
  }
};

// Current stored URL (in-memory cache)
var currentModifiedUrl = '';
var currentVideoId = '';

// In-memory state for popup reactivity
var uiState = {
  modifiedUrl: '',
  videoId: '',
  lastUpdated: null
};

// Action dispatcher — scalable, replaces if-else chains
var handlers = {
  thumbnailClicked: function(data) { saveUrl(data); },
  videoChanged: function(data) { saveUrl(data); },
  videoNavigate: function(data) { saveUrl(data); },
  getStoredUrl: function(request, sender, sendResponse) {
    sendResponse({ modifiedUrl: currentModifiedUrl, videoId: currentVideoId });
    return true;
  },
  getUIState: function(request, sender, sendResponse) {
    sendResponse(uiState);
    return true;
  }
};

function saveUrl(data) {
  currentModifiedUrl = data.modifiedUrl || '';
  currentVideoId = data.videoId || '';
  uiState.modifiedUrl = currentModifiedUrl;
  uiState.videoId = currentVideoId;
  uiState.lastUpdated = Date.now();
  api.storage.set({ modifiedUrl: currentModifiedUrl, videoId: currentVideoId, version: 1 });
}

// Load from storage on startup
function loadSavedUrl() {
  api.storage.get(['modifiedUrl', 'videoId', 'version']).then(function(items) {
    if (items.modifiedUrl) {
      currentModifiedUrl = items.modifiedUrl;
      currentVideoId = items.videoId || '';
      uiState.modifiedUrl = currentModifiedUrl;
      uiState.videoId = currentVideoId;
    }
  }).catch(function() {});
}

loadSavedUrl();

// Listen for messages — dispatcher pattern
if (runtimeAPI && runtimeAPI.onMessage) {
  runtimeAPI.onMessage.addListener(function(request, sender, sendResponse) {
    var handler = handlers[request.action];
    if (handler) {
      return handler(request, sender, sendResponse);
    }
  });
}

// Extension install
if (runtimeAPI && runtimeAPI.onInstalled) {
  runtimeAPI.onInstalled.addListener(function(details) {
    console.log('YTQuickLink installed/updated');
  });
}
