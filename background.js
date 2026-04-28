// YTQuickLink - Background Script (State Engine + Event Bus)
// Single source of truth — only stores, validates, broadcasts state

var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);
var BASE_URL = 'https://www.yout-ube.com';
var SCHEMA_VERSION = 1;

// Current state (in-memory)
var state = {
  videoId: '',
  modifiedUrl: '',
  lastUpdated: null,
  version: SCHEMA_VERSION
};

// Reducer — pure state transitions
function reduce(event) {
  switch (event.type) {
    case 'VIDEO_CHANGED':
    case 'THUMBNAIL_CLICKED':
    case 'VIDEO_NAVIGATE':
      state.videoId = event.payload.videoId || '';
      state.modifiedUrl = event.payload.modifiedUrl || buildWatchUrl(state.videoId);
      state.lastUpdated = event.ts || Date.now();
      break;
    default:
      break;
  }
  return state;
}

// URL builders
function buildWatchUrl(videoId) {
  return BASE_URL + '/watch?v=' + videoId;
}

// Storage wrapper
var api = {
  storage: {
    get: function(keys) { return runtimeAPI.storage.local.get(keys); },
    set: function(data) { return runtimeAPI.storage.local.set(data); }
  }
};

// Broadcast state to all listeners
function broadcastState() {
  if (runtimeAPI && runtimeAPI.tabs) {
    runtimeAPI.tabs.query({ url: '*://www.youtube.com/*' }).then(function(tabs) {
      tabs.forEach(function(tab) {
        runtimeAPI.tabs.sendMessage(tab.id, {
          type: 'STATE_UPDATE',
          version: SCHEMA_VERSION,
          payload: state,
          ts: Date.now()
        }).catch(function() {});
      });
    }).catch(function() {});
  }
}

// Event handlers
var handlers = {
  VIDEO_CHANGED: function(data) {
    var event = { type: data.type, payload: data, ts: Date.now() };
    var newState = reduce(event);
    api.storage.set({ videoId: newState.videoId, modifiedUrl: newState.modifiedUrl, lastUpdated: newState.lastUpdated, version: SCHEMA_VERSION });
    broadcastState();
  },
  THUMBNAIL_CLICKED: function(data) {
    var event = { type: data.type, payload: data, ts: Date.now() };
    var newState = reduce(event);
    api.storage.set({ videoId: newState.videoId, modifiedUrl: newState.modifiedUrl, lastUpdated: newState.lastUpdated, version: SCHEMA_VERSION });
  },
  VIDEO_NAVIGATE: function(data) {
    var event = { type: data.type, payload: data, ts: Date.now() };
    reduce(event);
  },
  GET_STATE: function(request, sender, sendResponse) {
    sendResponse(state);
    return true;
  }
};

// Load persisted state on startup
function init() {
  api.storage.get(['videoId', 'modifiedUrl', 'lastUpdated', 'version']).then(function(items) {
    if (items.videoId) {
      state.videoId = items.videoId;
      state.modifiedUrl = items.modifiedUrl || buildWatchUrl(items.videoId);
      state.lastUpdated = items.lastUpdated || null;
    }
  }).catch(function() {});
}
init();

// Message listener — dispatcher pattern
if (runtimeAPI && runtimeAPI.onMessage) {
  runtimeAPI.onMessage.addListener(function(request, sender, sendResponse) {
    var handler = handlers[request.type] || handlers[request.action];
    if (handler) {
      return handler(request, sender, sendResponse);
    }
  });
}

if (runtimeAPI && runtimeAPI.onInstalled) {
  runtimeAPI.onInstalled.addListener(function() {
    console.log('YTQuickLink installed/updated');
  });
}
