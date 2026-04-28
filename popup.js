// YTQuickLink - Popup Script (v4 — Read-Only Renderer)
// Requests state from background, renders UI, sends user actions only

var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);
var BASE_URL = 'https://www.yout-ube.com';
var SCHEMA_VERSION = 1;

// Unified API wrapper
var api = {
  tabs: runtimeAPI ? runtimeAPI.tabs : (typeof chrome !== 'undefined' ? chrome.tabs : null),
  messaging: runtimeAPI,
  storage: runtimeAPI ? runtimeAPI.storage : null
};

// Add mode indicator to popup UI
function addModeIndicator() {
  var container = document.createElement('div');
  container.id = 'ytql-mode';
  container.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff0000;margin-right:6px;vertical-align:middle;';
  var label = document.createElement('span');
  label.id = 'ytql-mode-label';
  label.style.cssText = 'font-size:11px;color:#666;';
  label.textContent = 'Inactive';
  var infoDiv = document.getElementById('s');
  if (infoDiv) {
    infoDiv.insertBefore(container, infoDiv.firstChild);
    infoDiv.appendChild(label);
  }
}

function updateModeIndicator(isActive) {
  var dot = document.getElementById('ytql-mode');
  var label = document.getElementById('ytql-mode-label');
  if (dot) dot.style.background = isActive ? '#00aa00' : '#ff0000';
  if (label) label.textContent = isActive ? 'Active' : 'Inactive';
}
  modifiedUrl: '',
  videoId: '',
  status: 'idle',
  error: null,
  lastUpdated: null
};

function buildWatchUrl(videoId) {
  return BASE_URL + '/watch?v=' + videoId;
}

function setUI(title, status, resultText, resultClass) {
  var t = document.getElementById('t');
  var s = document.getElementById('s');
  var r = document.getElementById('r');
  var rt = document.getElementById('rt');

  if (t) t.textContent = title || '-';
  if (s) s.textContent = status || '-';
  if (rt) rt.textContent = resultText || '';
  if (r) {
    r.className = resultClass || '';
    r.style.display = resultText ? 'block' : 'none';
  }
}

function updateUIFromState(state) {
  uiState.modifiedUrl = state.modifiedUrl || '';
  uiState.videoId = state.videoId || '';
  uiState.lastUpdated = state.lastUpdated || null;
  uiState.error = null;

  if (uiState.videoId) {
    setUI('YouTube Video', 'ID: ' + uiState.videoId, '', '');
    var lnk = document.getElementById('lnk');
    if (lnk) {
      lnk.href = uiState.modifiedUrl;
      lnk.style.display = 'inline-block';
    }
  }
}

// Request current state from background
function requestState() {
  if (!api.messaging) {
    setUI('Error', '', 'Extension API unavailable', 'err');
    return;
  }
  api.messaging.sendMessage({ type: 'GET_STATE' }).then(function(state) {
    if (state && state.videoId) {
      updateUIFromState(state);
    } else {
      // No stored state — try to get from active tab
      getFromActiveTab();
    }
  }).catch(function() {
    getFromActiveTab();
  });
}

function getFromActiveTab() {
  if (!api.tabs) {
    setUI('Ready', 'No state', '', '');
    return;
  }
  api.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
    var tab = tabs[0];
    if (!tab || !tab.url) return;
    if (tab.url.indexOf('youtube.com') === -1) {
      setUI('Not YouTube', '', 'Open a YouTube video page', '');
      return;
    }
    try {
      var urlObj = new URL(tab.url);
      var videoId = urlObj.searchParams.get('v') || (urlObj.hostname === 'youtu.be' ? urlObj.pathname.slice(1) : null);
      if (!videoId) return;
      uiState.videoId = videoId;
      uiState.modifiedUrl = buildWatchUrl(videoId);
      setUI('YouTube Video', 'ID: ' + videoId, '', '');
      var lnk = document.getElementById('lnk');
      if (lnk) {
        lnk.href = uiState.modifiedUrl;
        lnk.style.display = 'inline-block';
      }
    } catch (e) {}
  }).catch(function() {});
}

function handleGrabLink() {
  setUI('Detecting...', 'Getting video...', '', '');
  requestState();
}

function handleOpenLink(e) {
  e.preventDefault();
  if (!uiState.modifiedUrl) {
    handleGrabLink();
  } else {
    window.open(uiState.modifiedUrl, '_blank');
  }
}

// Listen for background state updates (reactive — no manual refresh)
if (api.messaging && api.messaging.onMessage) {
  api.messaging.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'STATE_UPDATE' && request.payload) {
      updateUIFromState(request.payload);
      if (request.payload.activeMode !== undefined) {
        updateModeIndicator(request.payload.activeMode);
      }
    }
  });
}

// Copy button
function handleCopyLink() {
  if (!uiState.modifiedUrl) {
    handleGrabLink();
    return;
  }
  navigator.clipboard.writeText(uiState.modifiedUrl).then(function() {
    setUI('YouTube Video', 'ID: ' + uiState.videoId, '\u2713 Copied!', 'suc');
  }).catch(function() {
    setUI('YouTube Video', 'ID: ' + uiState.videoId, 'Copy failed', 'err');
  });
}

var btn = document.getElementById('btn');
var lnk = document.getElementById('lnk');

if (btn) btn.onclick = handleGrabLink;
if (lnk) lnk.onclick = handleOpenLink;

var init = function() {
  addModeIndicator();
  requestState();
};
