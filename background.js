// YTQuickLink - Background Script (State Engine + Event Bus)
// Single source of truth — stores, validates, broadcasts state

var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);
var BASE_URL = 'https://www.yout-ube.com';
var SCHEMA_VERSION = 1;

// Current state (always a valid object — never null)
var state = {
  videoId: '',
  modifiedUrl: '',
  lastUpdated: null,
  version: SCHEMA_VERSION,
  activeMode: false
};

// Build modified URL
function buildWatchUrl(videoId) {
  return BASE_URL + '/watch?v=' + videoId;
}

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
    case 'STATE_UPDATE':
      // Apply full state from storage hydration
      if (event.payload) {
        state.videoId = event.payload.videoId || '';
        state.modifiedUrl = event.payload.modifiedUrl || buildWatchUrl(state.videoId);
        state.activeMode = event.payload.activeMode !== undefined ? event.payload.activeMode : false;
        state.lastUpdated = event.payload.lastUpdated || Date.now();
      }
      break;
    default:
      break;
  }
  return state;
}

// Storage wrapper
var api = {
  storage: {
    get: function(keys) { return runtimeAPI.storage.local.get(keys); },
    set: function(data) { return runtimeAPI.storage.local.set(data); }
  }
};

// Broadcast state to all YouTube tabs
function broadcastState() {
  if (runtimeAPI && runtimeAPI.tabs) {
    runtimeAPI.tabs.query({ url: ['*://www.youtube.com/*', '*://m.youtube.com/*', '*://music.youtube.com/*'] }).then(function(tabs) {
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

// Safe state response — always returns a valid object
function getState() {
  return {
    videoId: state.videoId || '',
    modifiedUrl: state.modifiedUrl || '',
    activeMode: state.activeMode || false,
    lastUpdated: state.lastUpdated || null,
    version: SCHEMA_VERSION
  };
}

// Event handlers
var handlers = {
  VIDEO_CHANGED: function(data, sender, sendResponse) {
    var event = { type: data.type, payload: data.payload || data, ts: Date.now() };
    reduce(event);
    api.storage.set({ videoId: state.videoId, modifiedUrl: state.modifiedUrl, lastUpdated: state.lastUpdated, activeMode: state.activeMode, version: SCHEMA_VERSION });
    broadcastState();
    sendResponse({ ok: true });
    return true;
  },
  THUMBNAIL_CLICKED: function(data, sender, sendResponse) {
    var event = { type: data.type, payload: data.payload || data, ts: Date.now() };
    reduce(event);
    api.storage.set({ videoId: state.videoId, modifiedUrl: state.modifiedUrl, lastUpdated: state.lastUpdated, activeMode: state.activeMode, version: SCHEMA_VERSION });
    sendResponse({ ok: true });
    return true;
  },
  VIDEO_NAVIGATE: function(data, sender, sendResponse) {
    var event = { type: data.type, payload: data.payload || data, ts: Date.now() };
    reduce(event);
    sendResponse({ ok: true });
    return true;
  },
  GET_STATE: function(request, sender, sendResponse) {
    sendResponse(getState());
    return true;
  },
  ACTIVE_MODE_CHANGED: function(data, sender, sendResponse) {
    state.activeMode = !!(data.payload && data.payload.activeMode);
    broadcastState();
    sendResponse({ ok: true });
    return true;
  }
};

// Load persisted state on startup — hydration
function init() {
  api.storage.get(['videoId', 'modifiedUrl', 'lastUpdated', 'activeMode', 'version']).then(function(items) {
    if (items.videoId) {
      state.videoId = items.videoId;
      state.modifiedUrl = items.modifiedUrl || buildWatchUrl(items.videoId);
      state.lastUpdated = items.lastUpdated || null;
    }
    state.activeMode = items.activeMode !== undefined ? items.activeMode : false;
  }).catch(function() {});
}
init();

// Message listener — dispatcher
if (runtimeAPI && runtimeAPI.onMessage) {
  runtimeAPI.onMessage.addListener(function(request, sender, sendResponse) {
    var handler = handlers[request.type] || handlers[request.action];
    if (handler) {
      return handler(request, sender, sendResponse);
    }
    // Unknown message — still respond to prevent unresolved promise
    sendResponse(null);
    return true;
  });
}

if (runtimeAPI && runtimeAPI.onInstalled) {
  runtimeAPI.onInstalled.addListener(function() {
    console.log('YTQuickLink installed/updated');
  });
}
