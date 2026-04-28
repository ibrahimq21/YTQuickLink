// YTQuickLink - Popup Script (v5.1 — PURE VIEW)
// Requests state from background, renders UI, sends user actions ONLY
// No fallback logic, no tab parsing — background is single source of truth

var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);
var BASE_URL = 'https://www.yout-ube.com';
var SCHEMA_VERSION = 1;

// Unified API wrapper — MV3-safe Promise wrapper with callback guarantee
function sendMessage(msg) {
  return new Promise(function(resolve) {
    if (!runtimeAPI || !runtimeAPI.sendMessage) {
      resolve(null);
      return;
    }
    runtimeAPI.sendMessage(msg, function(response) {
      resolve(response || null);
    });
  });
}

var api = {
  tabs: runtimeAPI ? runtimeAPI.tabs : (typeof chrome !== 'undefined' ? chrome.tabs : null),
  messaging: runtimeAPI,
  storage: runtimeAPI ? runtimeAPI.storage : null
};

// UI state — local only (not shared with extension)
var uiState = {
  modifiedUrl: '',
  videoId: '',
  status: 'idle',
  error: null,
  activeMode: false,
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

function updateModeIndicator(isActive) {
  var dot = document.getElementById('ytql-mode');
  var label = document.getElementById('ytql-mode-label');
  if (dot) dot.style.background = isActive ? '#00aa00' : '#ff0000';
  if (label) label.textContent = isActive ? 'Active' : 'Inactive';
}

function addModeIndicator() {
  var s = document.getElementById('s');
  if (!s) return;
  var dot = document.createElement('span');
  dot.id = 'ytql-mode';
  dot.style.cssText = 'display:inline-block;width:9px;height:9px;border-radius:50%;background:#ff0000;margin-right:5px;vertical-align:middle;';
  var label = document.createElement('span');
  label.id = 'ytql-mode-label';
  label.style.cssText = 'font-size:11px;color:#888;margin-right:8px;';
  label.textContent = 'Inactive';
  s.insertBefore(dot, s.firstChild);
  s.insertBefore(label, s.firstChild.nextSibling);
}

function updateUIFromState(state) {
  uiState.modifiedUrl = state.modifiedUrl || '';
  uiState.videoId = state.videoId || '';
  uiState.lastUpdated = state.lastUpdated || null;
  uiState.activeMode = state.activeMode !== undefined ? state.activeMode : false;
  uiState.error = null;

  updateModeIndicator(uiState.activeMode);

  if (uiState.videoId) {
    setUI('YouTube Video', 'ID: ' + uiState.videoId, '', '');
    var lnk = document.getElementById('lnk');
    if (lnk) {
      lnk.href = uiState.modifiedUrl;
      lnk.style.display = 'inline-block';
    }
  } else {
    setUI('No Video', '', 'Open a YouTube video first', '');
  }
}

function requestState() {
  setUI('Loading...', '', '', '');
  sendMessage({ type: 'GET_STATE', version: SCHEMA_VERSION }).then(function(state) {
    state = state && typeof state === 'object' ? state : {};
    updateUIFromState(state);
    // If background has no URL, fall back to reading active tab directly
    if (!uiState.modifiedUrl || !uiState.videoId) {
      getFromActiveTab();
    }
  }).catch(function() {
    getFromActiveTab();
  });
}

function getFromActiveTab() {
  console.log('[YTQL popup] getFromActiveTab: querying active tab');
  if (!api.tabs) {
    console.log('[YTQL popup] no tabs API available');
    setUI('No Video', '', 'Open a YouTube video first', '');
    return;
  }
  api.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
    var tab = tabs[0];
    if (!tab || !tab.url) {
      console.log('[YTQL popup] no active tab found');
      setUI('No Tab', '', 'No active tab', 'err');
      return;
    }
    console.log('[YTQL popup] active tab URL:', tab.url);
    if (tab.url.indexOf('youtube.com') === -1 && tab.url.indexOf('youtu.be') === -1) {
      setUI('Not YouTube', '', 'Open a YouTube video first', '');
      return;
    }
    try {
      var urlObj = new URL(tab.url);
      var videoId = urlObj.searchParams.get('v') || (urlObj.hostname === 'youtu.be' ? urlObj.pathname.slice(1) : null);
      if (!videoId) {
        console.log('[YTQL popup] no videoId in URL:', tab.url);
        setUI('No Video', '', 'Open a YouTube video first', '');
        return;
      }
      uiState.videoId = videoId;
      uiState.modifiedUrl = buildWatchUrl(videoId);
      uiState.activeMode = false;
      updateModeIndicator(false);
      console.log('[YTQL popup] parsed from tab — videoId:', videoId, 'modifiedUrl:', uiState.modifiedUrl);
      setUI('YouTube Video', 'ID: ' + videoId, '', '');
      var lnk = document.getElementById('lnk');
      if (lnk) {
        lnk.href = uiState.modifiedUrl;
        lnk.style.display = 'inline-block';
      }
    } catch (e) {
      console.error('[YTQL popup] URL parse error:', e);
      setUI('Error', '', 'Invalid URL', 'err');
    }
  }).catch(function(err) {
    console.error('[YTQL popup] tab query failed:', err);
    setUI('Error', '', 'Could not access tab', 'err');
  });
}

function handleCopy(e) {
  console.log('[YTQL popup] handleCopy called', { modifiedUrl: uiState.modifiedUrl, videoId: uiState.videoId });
  if (!uiState.modifiedUrl) {
    console.log('[YTQL popup] no URL cached, requesting state');
    requestState();
    return;
  }
  navigator.clipboard.writeText(uiState.modifiedUrl).then(function() {
    console.log('[YTQL popup] copied to clipboard:', uiState.modifiedUrl);
    setUI('YouTube Video', 'ID: ' + uiState.videoId, '\u2713 Copied!', 'suc');
  }).catch(function(err) {
    console.error('[YTQL popup] copy failed:', err);
    setUI('YouTube Video', 'ID: ' + uiState.videoId, 'Copy failed', 'err');
  });
}

function handleOpenModifiedPage(e) {
  console.log('[YTQL popup] handleOpenModifiedPage called', { modifiedUrl: uiState.modifiedUrl });
  e.preventDefault();
  if (uiState.modifiedUrl) {
    console.log('[YTQL popup] opening modified URL:', uiState.modifiedUrl);
    window.open(uiState.modifiedUrl, '_blank');
  } else {
    console.log('[YTQL popup] no URL, requesting state first');
    requestState();
  }
}

// Listen for background STATE_UPDATE pushes — reactive, no polling
if (runtimeAPI && runtimeAPI.onMessage) {
  runtimeAPI.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'STATE_UPDATE' && request.payload) {
      updateUIFromState(request.payload);
    }
  });
}

// Wire up buttons
var btn = document.getElementById('btn');
var lnk = document.getElementById('lnk');

if (btn) btn.addEventListener('click', handleCopy);
if (lnk) lnk.addEventListener('click', handleOpenModifiedPage);

addModeIndicator();
requestState();
