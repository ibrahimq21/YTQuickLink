// YTQuickLink - Popup Script v3.0

var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);

// Unified API wrapper
var api = {
  tabs: runtimeAPI ? runtimeAPI.tabs : (typeof chrome !== 'undefined' ? chrome.tabs : null),
  messaging: runtimeAPI,
  storage: runtimeAPI ? runtimeAPI.storage : null
};

// UI state — separate from extension state
var uiState = {
  modifiedUrl: '',
  videoId: '',
  status: 'idle',
  error: null
};

// Versioned storage schema
var STORAGE_VERSION = 1;

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

function getYouTubeUrl() {
  if (!api.tabs) {
    return Promise.resolve({ error: 'No tabs API available' });
  }

  return api.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
    var tab = tabs[0];
    if (!tab || !tab.url) return { error: 'No active tab' };
    if (tab.url.indexOf('youtube.com') === -1) return { error: 'Not on YouTube' };

    var urlObj = new URL(tab.url);
    var videoId = urlObj.searchParams.get('v') || (urlObj.hostname === 'youtu.be' ? urlObj.pathname.slice(1) : null);
    if (!videoId) return { error: 'No video ID' };

    return {
      videoId: videoId,
      modifiedUrl: 'https://www.yout-ube.com/watch?v=' + videoId,
      tabId: tab.id
    };
  }).catch(function(err) {
    return { error: err.message || 'Tab query failed' };
  });
}

function handleGrabLink() {
  setUI('Detecting...', 'Getting video...', '', '');

  getYouTubeUrl().then(function(data) {
    if (data.error) {
      setUI('Error', '', data.error, 'err');
      uiState.error = data.error;
      return;
    }

    uiState.modifiedUrl = data.modifiedUrl;
    uiState.videoId = data.videoId;
    uiState.error = null;

    setUI('YouTube Video', 'ID: ' + data.videoId, '', '');

    var lnk = document.getElementById('lnk');
    if (lnk) {
      lnk.href = uiState.modifiedUrl;
      lnk.style.display = 'inline-block';
    }

    navigator.clipboard.writeText(uiState.modifiedUrl).then(function() {
      setUI('YouTube Video', 'ID: ' + data.videoId, '\u2713 Copied!', 'suc');
    }).catch(function() {
      setUI('YouTube Video', 'ID: ' + data.videoId, 'Copy failed — clipboard unavailable', 'err');
    });
  });
}

// Listen for background state updates (reactive UI — no refresh needed)
if (api.messaging && api.messaging.onMessage) {
  api.messaging.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'stateUpdate') {
      uiState.modifiedUrl = request.modifiedUrl || uiState.modifiedUrl;
      uiState.videoId = request.videoId || uiState.videoId;
      var lnk = document.getElementById('lnk');
      if (lnk && uiState.modifiedUrl) {
        lnk.href = uiState.modifiedUrl;
        lnk.style.display = 'inline-block';
      }
    }
  });
}

function handleOpenLink(e) {
  e.preventDefault();
  if (!uiState.modifiedUrl) {
    handleGrabLink();
  } else {
    window.open(uiState.modifiedUrl, '_blank');
  }
}

var btn = document.getElementById('btn');
var lnk = document.getElementById('lnk');

if (btn) btn.onclick = handleGrabLink;
if (lnk) lnk.onclick = handleOpenLink;

// Auto-detect on open
handleGrabLink();
